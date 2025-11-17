import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, linkWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Analytics - only initialize on client side
let analytics: ReturnType<typeof getAnalytics> | undefined;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Helper function to ensure user is authenticated anonymously
export const ensureAnonymousAuth = async (): Promise<string> => {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user.uid;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    throw error;
  }
};

// Helper function to check if user is anonymous
export const isAnonymousUser = (): boolean => {
  return auth.currentUser?.isAnonymous ?? true;
};

// Helper function to sign in with Google
export const signInWithGoogle = async (): Promise<{ userId: string; isNewUser: boolean }> => {
  try {
    console.log('🔐 Starting Google sign-in...');
    
    // Check if user is already signed in with Google
    const currentUser = auth.currentUser;
    if (currentUser && !currentUser.isAnonymous) {
      console.log('✅ User already signed in with Google');
      return { userId: currentUser.uid, isNewUser: false };
    }
    
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const wasAnonymous = currentUser?.isAnonymous ?? false;
    console.log('👤 Current user anonymous:', wasAnonymous);
    
    // Use popup method
    let result;
    let userId: string;
    
    if (wasAnonymous && currentUser) {
      // Try to link anonymous account with Google
      console.log('🔗 Attempting to link anonymous account with Google...');
      try {
        result = await linkWithPopup(currentUser, provider);
        userId = result.user.uid;
        console.log('✅ Accounts linked successfully');
      } catch (linkError: any) {
        // If account already exists, sign in with Google instead
        if (linkError.code === 'auth/credential-already-in-use') {
          console.log('ℹ️ Google account already exists, signing in instead...');
          try {
            result = await signInWithPopup(auth, provider);
            userId = result.user.uid;
            console.log('✅ Signed in with existing Google account');
          } catch (popupError: any) {
            throw popupError;
          }
        } else if (linkError.code === 'auth/popup-blocked' || linkError.code === 'auth/cancelled-popup-request') {
          console.log('⚠️ Popup blocked while linking accounts');
          throw linkError;
        } else {
          throw linkError;
        }
      }
    } else {
      // Regular Google sign-in
      console.log('📱 Regular Google sign-in...');
      try {
        result = await signInWithPopup(auth, provider);
        userId = result.user.uid;
      } catch (popupError: any) {
        throw popupError;
      }
    }
    
    console.log('👤 User ID:', userId);
    
    // Award 3 free customizations for new Google users
    const userDoc = doc(db, 'users', userId);
    const userSnap = await getDoc(userDoc);
    let isNewUser = false;
    
    if (!userSnap.exists()) {
      console.log('🆕 New user - creating with 3 customizations');
      isNewUser = true;
      // New user - create with 3 free customizations
      const newUserData = {
        customizationsUsed: 0,
        customizationsAllowed: 3,
        createdAt: new Date(),
        isGoogleUser: true,
      };
      await setDoc(userDoc, newUserData);
      console.log('✅ User document created successfully');
      
      // Verify the write
      const verifySnap = await getDoc(userDoc);
      if (verifySnap.exists()) {
        console.log('✅ Verified - user data:', verifySnap.data());
      } else {
        console.error('❌ User document creation failed - document does not exist after setDoc');
      }
    } else {
      const currentData = userSnap.data();
      const currentAllowed = currentData.customizationsAllowed || 0;
      console.log('👥 Existing user - current customizations:', currentAllowed);
      
      // Check if user already has the Google login bonus
      if (currentData.isGoogleUser) {
        console.log('ℹ️ User already received Google login bonus');
        isNewUser = false;
      } else {
        // First time logging in with Google - increase customizationsAllowed by 3
        isNewUser = true;
        const newAllowed = currentAllowed + 3;
        await updateDoc(userDoc, {
          customizationsAllowed: newAllowed,
          isGoogleUser: true,
        });
        console.log(`✅ Customizations increased from ${currentAllowed} to ${newAllowed}`);
        
        // Verify the update
        const verifySnap = await getDoc(userDoc);
        if (verifySnap.exists()) {
          console.log('✅ Verified - updated data:', verifySnap.data());
        }
      }
    }
    
    return { userId, isNewUser };
  } catch (error: any) {
    // Handle popup cancellation silently (user just closed it or opened multiple)
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log('ℹ️ User cancelled the sign-in popup');
      throw new Error('POPUP_CANCELLED'); // Special error code to handle silently
    }
    
    console.error('❌ Error signing in with Google:', error);
    
    // Handle other errors
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Прозорецът за вход беше блокиран от браузъра. Моля, разрешете изскачащи прозорци за този сайт и опитайте отново.');
    }
    
    throw error;
  }
};

interface UserData {
  customizationsUsed: number;
  customizationsAllowed: number;
  createdAt: Date;
  lastCustomizationAt?: Date;
  hasListenedToDefault?: boolean;
}

// Get or create user document
export const getUserData = async (userId: string, createIfMissing: boolean = true): Promise<UserData> => {
  const userDoc = doc(db, 'users', userId);
  const userSnap = await getDoc(userDoc);
  
  if (userSnap.exists()) {
    const data = userSnap.data() as UserData;
    console.log('📖 Retrieved user data:', { userId, customizationsAllowed: data.customizationsAllowed, customizationsUsed: data.customizationsUsed });
    return data;
  }
  
  if (!createIfMissing) {
    console.log('⚠️ User document not found and createIfMissing is false');
    return {
      customizationsUsed: 0,
      customizationsAllowed: 0,
      createdAt: new Date(),
    };
  }
  
  // Create new user with default allowance
  console.log('🆕 Creating new user document with 0 customizations');
  const newUserData: UserData = {
    customizationsUsed: 0,
    customizationsAllowed: 0, // Default: 0 customizations per user
    createdAt: new Date(),
  };
  
  await setDoc(userDoc, newUserData);
  return newUserData;
};

// Check if user can customize
export const canUserCustomize = async (userId: string): Promise<boolean> => {
  const userData = await getUserData(userId);
  return userData.customizationsUsed < userData.customizationsAllowed;
};

// Increment user customization count
export const incrementCustomizationCount = async (userId: string): Promise<void> => {
  const userDoc = doc(db, 'users', userId);
  await updateDoc(userDoc, {
    customizationsUsed: increment(1),
    lastCustomizationAt: new Date(),
  });
};

// Mark user as having listened to default message
export const markDefaultMessageListened = async (userId: string): Promise<void> => {
  const userDoc = doc(db, 'users', userId);
  await updateDoc(userDoc, {
    hasListenedToDefault: true,
  });
};

// Add customizations to user's allowed count
export const addCustomizationsToUser = async (userId: string, amount: number): Promise<void> => {
  const userDoc = doc(db, 'users', userId);
  await updateDoc(userDoc, {
    customizationsAllowed: increment(amount),
  });
};

export { app, db, storage, analytics, auth };
