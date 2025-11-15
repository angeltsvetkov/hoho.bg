import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

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
let analytics;
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

interface UserData {
  customizationsUsed: number;
  customizationsAllowed: number;
  createdAt: Date;
  lastCustomizationAt?: Date;
  hasListenedToDefault?: boolean;
}

// Get or create user document
export const getUserData = async (userId: string): Promise<UserData> => {
  const userDoc = doc(db, 'users', userId);
  const userSnap = await getDoc(userDoc);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserData;
  }
  
  // Create new user with default allowance
  const newUserData: UserData = {
    customizationsUsed: 0,
    customizationsAllowed: 3, // Default: 3 customizations per user
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

export { app, db, storage, analytics, auth };
