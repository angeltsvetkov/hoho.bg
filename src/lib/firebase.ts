import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, linkWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult } from 'firebase/auth';

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

// Helper to detect if popups are supported/allowed
const canUsePopup = (): boolean => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return false;
    
    // Check for localhost - always use redirect on localhost to avoid COOP issues
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🌐 Localhost detected, using redirect method to avoid COOP issues');
      return false;
    }
    
    // Try to detect Arc browser and other strict browsers
    const userAgent = navigator.userAgent.toLowerCase();
    // Arc browser is based on Chromium but doesn't identify itself clearly
    // Better to use redirect by default for compatibility
    const isArc = userAgent.includes('arc');
    
    // Arc and similar browsers block popups by default, use redirect
    if (isArc) {
      console.log('🌐 Arc browser detected, using redirect method');
      return false;
    }
    
    // Default to redirect for better compatibility
    // Popup method has issues with COOP headers in development
    return false;
  } catch {
    return false;
  }
};

// Helper function to check and handle redirect result
export const handleRedirectResult = async (): Promise<{ userId: string; isNewUser: boolean } | null> => {
  try {
    console.log('🔍 Checking for redirect result...');
    
    // Check if we just came back from a redirect
    // The URL will have been cleaned by Firebase, but we can check sessionStorage
    const pendingRedirect = sessionStorage.getItem('pendingRedirect');
    if (pendingRedirect) {
      console.log('📍 Pending redirect detected in session storage');
      sessionStorage.removeItem('pendingRedirect');
    }
    
    const result = await getRedirectResult(auth);
    
    if (!result) {
      console.log('ℹ️ No redirect result found');
      // Check if user is signed in (might have been processed already)
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        console.log('✅ User is already signed in with Google (redirect was already processed)');
        const userId = auth.currentUser.uid;
        
        // Check if we need to award customizations
        const userDoc = doc(db, 'users', userId);
        const userSnap = await getDoc(userDoc);
        let isNewUser = false;
        
        if (!userSnap.exists()) {
          console.log('🆕 New user - creating with 3 customizations');
          isNewUser = true;
          await setDoc(userDoc, {
            customizationsUsed: 0,
            customizationsAllowed: 3,
            createdAt: new Date(),
            isGoogleUser: true,
          });
          console.log('✅ User document created successfully');
          return { userId, isNewUser };
        } else if (!userSnap.data().isGoogleUser) {
          console.log('🎁 Existing anonymous user, awarding Google login bonus');
          isNewUser = true;
          const currentAllowed = userSnap.data().customizationsAllowed || 0;
          await updateDoc(userDoc, {
            customizationsAllowed: currentAllowed + 3,
            isGoogleUser: true,
          });
          console.log(`✅ Customizations increased from ${currentAllowed} to ${currentAllowed + 3}`);
          return { userId, isNewUser };
        }
      }
      return null;
    }
    
    console.log('✅ Redirect sign-in successful');
    const userId = result.user.uid;
    
    // Award customizations (same logic as popup)
    const userDoc = doc(db, 'users', userId);
    const userSnap = await getDoc(userDoc);
    let isNewUser = false;
    
    if (!userSnap.exists()) {
      console.log('🆕 New user - creating with 3 customizations');
      isNewUser = true;
      await setDoc(userDoc, {
        customizationsUsed: 0,
        customizationsAllowed: 3,
        createdAt: new Date(),
        isGoogleUser: true,
      });
      console.log('✅ User document created successfully');
    } else {
      const currentData = userSnap.data();
      if (!currentData.isGoogleUser) {
        isNewUser = true;
        const currentAllowed = currentData.customizationsAllowed || 0;
        await updateDoc(userDoc, {
          customizationsAllowed: currentAllowed + 3,
          isGoogleUser: true,
        });
        console.log(`✅ Customizations increased from ${currentAllowed} to ${currentAllowed + 3}`);
      }
    }
    
    return { userId, isNewUser };
  } catch (error) {
    console.error('❌ Error handling redirect result:', error);
    return null;
  }
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
    
    const usePopup = canUsePopup();
    console.log('🎯 Using', usePopup ? 'popup' : 'redirect', 'method');
    
    let result;
    let userId: string;
    
    if (wasAnonymous && currentUser) {
      // Try to link anonymous account with Google
      console.log('🔗 Attempting to link anonymous account with Google...');
      try {
        if (usePopup) {
          result = await linkWithPopup(currentUser, provider);
          userId = result.user.uid;
          console.log('✅ Accounts linked successfully via popup');
        } else {
          // Use redirect - this will redirect the page
          console.log('🔄 Redirecting to Google sign-in...');
          sessionStorage.setItem('pendingRedirect', 'link');
          await linkWithRedirect(currentUser, provider);
          // This line won't be reached - page will redirect
          throw new Error('REDIRECT_IN_PROGRESS');
        }
      } catch (linkError) {
        const firebaseError = linkError as { code?: string; message?: string };
        console.log('⚠️ Link error:', firebaseError);
        
        // If account already exists, sign in with Google instead
        if (firebaseError.code === 'auth/credential-already-in-use') {
          console.log('ℹ️ Google account already exists, signing in instead...');
          if (usePopup) {
            try {
              result = await signInWithPopup(auth, provider);
              userId = result.user.uid;
              console.log('✅ Signed in with existing Google account via popup');
            } catch (popupError) {
              const popupFirebaseError = popupError as { code?: string; message?: string };
              console.log('⚠️ Popup error:', popupFirebaseError);
              // Handle popup blocked or COOP errors
              if (popupFirebaseError.code === 'auth/popup-blocked' || 
                  popupFirebaseError.code === 'auth/cancelled-popup-request' ||
                  (popupFirebaseError.message && popupFirebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
                console.log('⚠️ Popup blocked or COOP error, switching to redirect...');
                await signInWithRedirect(auth, provider);
                throw new Error('REDIRECT_IN_PROGRESS');
              }
              throw popupError;
            }
          } else {
            console.log('🔄 Redirecting to Google sign-in...');
            sessionStorage.setItem('pendingRedirect', 'signin');
            await signInWithRedirect(auth, provider);
            throw new Error('REDIRECT_IN_PROGRESS');
          }
        } else if (firebaseError.code === 'auth/popup-blocked' || 
                   firebaseError.code === 'auth/cancelled-popup-request' ||
                   firebaseError.code === 'auth/popup-closed-by-user' ||
                   (firebaseError.message && firebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
          console.log('⚠️ Popup blocked or COOP error, switching to redirect...');
          sessionStorage.setItem('pendingRedirect', 'link-fallback');
          await linkWithRedirect(currentUser, provider);
          throw new Error('REDIRECT_IN_PROGRESS');
        } else {
          throw linkError;
        }
      }
    } else {
      // Regular Google sign-in
      console.log('📱 Regular Google sign-in...');
      if (usePopup) {
        try {
          result = await signInWithPopup(auth, provider);
          userId = result.user.uid;
          console.log('✅ Signed in via popup');
        } catch (popupError) {
          const popupFirebaseError = popupError as { code?: string; message?: string };
          console.log('⚠️ Popup error:', popupFirebaseError);
          // Handle popup blocked, cancelled, or COOP errors
          if (popupFirebaseError.code === 'auth/popup-blocked' ||
              popupFirebaseError.code === 'auth/cancelled-popup-request' ||
              popupFirebaseError.code === 'auth/popup-closed-by-user' ||
              (popupFirebaseError.message && popupFirebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
            console.log('⚠️ Popup blocked or COOP error, switching to redirect...');
            sessionStorage.setItem('pendingRedirect', 'signin-fallback');
            await signInWithRedirect(auth, provider);
            throw new Error('REDIRECT_IN_PROGRESS');
          }
          throw popupError;
        }
      } else {
        console.log('🔄 Redirecting to Google sign-in...');
        sessionStorage.setItem('pendingRedirect', 'signin');
        await signInWithRedirect(auth, provider);
        throw new Error('REDIRECT_IN_PROGRESS');
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
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    // Handle redirect in progress (not an error)
    if (firebaseError.message === 'REDIRECT_IN_PROGRESS') {
      console.log('🔄 Redirect initiated, page will reload...');
      throw error; // Pass it up so UI can handle
    }
    
    // Handle popup cancellation silently (user just closed it or opened multiple)
    if (firebaseError.code === 'auth/popup-closed-by-user' || firebaseError.code === 'auth/cancelled-popup-request') {
      console.log('ℹ️ User cancelled the sign-in popup');
      throw new Error('POPUP_CANCELLED'); // Special error code to handle silently
    }
    
    console.error('❌ Error signing in with Google:', error);
    
    // Popup blocked errors should have already been handled by switching to redirect
    if (firebaseError.code === 'auth/popup-blocked') {
      throw new Error('Прозорецът за вход беше блокиран. Моля, презаредете страницата и опитайте отново.');
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

// Award referral bonus to the referrer
export const awardReferralBonus = async (referrerId: string, referredUserId: string): Promise<void> => {
  const referrerDoc = doc(db, 'users', referrerId);
  const referredDoc = doc(db, 'users', referredUserId);
  
  // Check if referrer exists
  const referrerSnap = await getDoc(referrerDoc);
  if (!referrerSnap.exists()) {
    console.warn('Referrer user not found:', referrerId);
    return;
  }
  
  // Check if referred user already used a referral code
  const referredSnap = await getDoc(referredDoc);
  if (referredSnap.exists() && referredSnap.data().referredBy) {
    console.log('User already used a referral code');
    return;
  }
  
  // Award 5 customizations to referrer
  await updateDoc(referrerDoc, {
    customizationsAllowed: increment(5),
  });
  
  // Mark referred user to prevent duplicate referrals
  await updateDoc(referredDoc, {
    referredBy: referrerId,
  });
  
  console.log(`✅ Awarded 5 customizations to referrer ${referrerId}`);
};

export { app, db, storage, analytics, auth };
