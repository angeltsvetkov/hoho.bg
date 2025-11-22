import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { GoogleAuthProvider, signInWithPopup, linkWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult, getAuth, browserLocalPersistence, setPersistence, onAuthStateChanged, User, UserCredential, Auth } from 'firebase/auth';

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

// Set persistence synchronously on module load
let persistenceSet = false;
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      persistenceSet = true;
    })
    .catch((error) => {
      console.error('❌ Error setting persistence:', error);
    });
}

// Helper to ensure persistence is set before operations
const ensurePersistence = async () => {
  if (typeof window === 'undefined') return;
  if (persistenceSet) return;

  // Wait for persistence to be set
  await setPersistence(auth, browserLocalPersistence);
  persistenceSet = true;
};



// Helper to detect if popups are supported/allowed
const canUsePopup = (): boolean => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return false;

    // Use popup method for all environments
    // Popup is more reliable and doesn't require Firebase Hosting configuration
    // Modern browsers allow popups when triggered by user action
    return true;
  } catch {
    return false;
  }
};

// Shared promise to prevent double-invocation in Strict Mode
let redirectResultPromise: Promise<UserCredential | null> | null = null;

const getSharedRedirectResult = (authInstance: Auth): Promise<UserCredential | null> => {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(authInstance);
  }
  return redirectResultPromise;
};

// Helper function to check and handle redirect result
export const handleRedirectResult = async (): Promise<{ userId: string; isNewUser: boolean } | null> => {
  try {
    await ensurePersistence();

    // Check if we just came back from a redirect
    // The URL will have been cleaned by Firebase, but we can check sessionStorage
    const pendingRedirect = sessionStorage.getItem('pendingRedirect');
    if (pendingRedirect) {
      sessionStorage.removeItem('pendingRedirect'); // Remove it now to prevent loops

      // First, try getRedirectResult to trigger Firebase to process the auth code
      let redirectResult = await getSharedRedirectResult(auth);

      // Check if user is already signed in (Firebase processed it before we checked)
      if (!redirectResult && auth.currentUser && !auth.currentUser.isAnonymous) {
        redirectResult = { user: auth.currentUser } as any;
      }

      // If still no result, wait for auth state to change (Firebase processes async)
      if (!redirectResult) {
        const googleUser = await new Promise<User | null>((resolve) => {
          let timeoutId: NodeJS.Timeout;
          let checkCount = 0;

          const unsubscribe = onAuthStateChanged(auth, (user) => {
            checkCount++;

            // If we get a Google user, resolve immediately
            if (user && !user.isAnonymous) {
              clearTimeout(timeoutId);
              unsubscribe();
              resolve(user);
            }
          });

          // Timeout after 10 seconds (increased from 3)
          timeoutId = setTimeout(() => {
            unsubscribe();
            // Last chance: check auth.currentUser one more time
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
              resolve(auth.currentUser);
            } else {
              resolve(null);
            }
          }, 10000);
        });

        if (googleUser) {
          redirectResult = { user: googleUser } as any;
        }
      }

      const googleUser = redirectResult?.user;
      // If we got a Google user, process migration
      const anonymousDataStr = sessionStorage.getItem('anonymousData');
      if (googleUser && anonymousDataStr) {
        const userId = googleUser.uid;

        sessionStorage.removeItem('anonymousData');
        sessionStorage.removeItem('anonymousUid');

        const oldData = JSON.parse(anonymousDataStr);

        // Check if we need to award customizations
        const userDoc = doc(db, 'users', userId);
        const userSnap = await getDoc(userDoc);

        if (!userSnap.exists()) {
          await setDoc(userDoc, {
            customizationsUsed: oldData.customizationsUsed || 0,
            customizationsAllowed: (oldData.customizationsAllowed || 0) + 3,
            createdAt: new Date(),
            isGoogleUser: true,
            hasListenedToDefault: oldData.hasListenedToDefault || false,
          });
          return { userId, isNewUser: true };
        } else if (!userSnap.data().isGoogleUser) {
          const currentAllowed = userSnap.data().customizationsAllowed || 0;
          await updateDoc(userDoc, {
            customizationsAllowed: currentAllowed + 3,
            isGoogleUser: true,
          });
          return { userId, isNewUser: true };
        } else {
          return { userId, isNewUser: false };
        }
      }

      // Check if user is signed in (might have been processed already)
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        const userId = auth.currentUser.uid;

        // Check if we need to award customizations
        const userDoc = doc(db, 'users', userId);
        const userSnap = await getDoc(userDoc);
        let isNewUser = false;

        if (!userSnap.exists()) {
          isNewUser = true;
          await setDoc(userDoc, {
            customizationsUsed: 0,
            customizationsAllowed: 3,
            createdAt: new Date(),
            isGoogleUser: true,
          });
          return { userId, isNewUser };
        } else if (!userSnap.data().isGoogleUser) {
          isNewUser = true;
          const currentAllowed = userSnap.data().customizationsAllowed || 0;
          await updateDoc(userDoc, {
            customizationsAllowed: currentAllowed + 3,
            isGoogleUser: true,
          });
          return { userId, isNewUser };
        }
      }
      return null;
    } // Close the if (pendingRedirect) block

    // No pending redirect - try normal getRedirectResult
    const result = await getSharedRedirectResult(auth);
    if (result) {
      const userId = result.user.uid;

      // Check if we need to migrate data from anonymous user
      const anonymousDataStr = sessionStorage.getItem('anonymousData');
      const oldAnonymousUid = sessionStorage.getItem('anonymousUid');

      if (anonymousDataStr) {
        sessionStorage.removeItem('anonymousData');
        sessionStorage.removeItem('anonymousUid');

        const oldData = JSON.parse(anonymousDataStr);

        // Merge with new Google user
        const userDoc = doc(db, 'users', userId);
        const userSnap = await getDoc(userDoc);

        if (!userSnap.exists()) {
          // New Google user - create with old data + bonus
          await setDoc(userDoc, {
            customizationsUsed: oldData.customizationsUsed || 0,
            customizationsAllowed: (oldData.customizationsAllowed || 0) + 3,
            createdAt: new Date(),
            isGoogleUser: true,
            hasListenedToDefault: oldData.hasListenedToDefault || false,
          });
          return { userId, isNewUser: true };
        } else {
          // Existing Google user - just mark as Google user and add bonus
          const currentData = userSnap.data();
          if (!currentData.isGoogleUser) {
            await updateDoc(userDoc, {
              customizationsAllowed: (currentData.customizationsAllowed || 0) + 3,
              isGoogleUser: true,
            });
            return { userId, isNewUser: true };
          }
          return { userId, isNewUser: false };
        }
      } else if (oldAnonymousUid) {
        // Fallback: try to get data from Firestore
        sessionStorage.removeItem('anonymousUid');

        // Get old anonymous user data
        const oldUserDoc = doc(db, 'users', oldAnonymousUid);
        const oldUserSnap = await getDoc(oldUserDoc);

        if (oldUserSnap.exists()) {
          const oldData = oldUserSnap.data();

          // Merge with new Google user
          const userDoc = doc(db, 'users', userId);
          const userSnap = await getDoc(userDoc);

          if (!userSnap.exists()) {
            // New Google user - create with old data + bonus
            await setDoc(userDoc, {
              customizationsUsed: oldData.customizationsUsed || 0,
              customizationsAllowed: (oldData.customizationsAllowed || 0) + 3,
              createdAt: new Date(),
              isGoogleUser: true,
              hasListenedToDefault: oldData.hasListenedToDefault || false,
            });
            return { userId, isNewUser: true };
          } else {
            // Existing Google user - just mark as Google user
            await updateDoc(userDoc, {
              isGoogleUser: true,
            });
            return { userId, isNewUser: false };
          }
        }
      }

      // Award customizations (same logic as popup)
      const userDoc = doc(db, 'users', userId);
      const userSnap = await getDoc(userDoc);
      let isNewUser = false;

      if (!userSnap.exists()) {
        isNewUser = true;
        await setDoc(userDoc, {
          customizationsUsed: 0,
          customizationsAllowed: 3,
          createdAt: new Date(),
          isGoogleUser: true,
        });
      } else {
        const currentData = userSnap.data();
        if (!currentData.isGoogleUser) {
          isNewUser = true;
          const currentAllowed = currentData.customizationsAllowed || 0;
          await updateDoc(userDoc, {
            customizationsAllowed: currentAllowed + 3,
            isGoogleUser: true,
          });
        }
      }

      return { userId, isNewUser };
    }

    // No result
    return null;
  } catch (error) {
    console.error('❌ Error handling redirect result:', error);
    return null;
  }
};

// Helper function to sign in with Google
export const signInWithGoogle = async (): Promise<{ userId: string; isNewUser: boolean }> => {
  try {
    await ensurePersistence();

    // Check if user is already signed in with Google
    const currentUser = auth.currentUser;
    if (currentUser && !currentUser.isAnonymous) {
      return { userId: currentUser.uid, isNewUser: false };
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const wasAnonymous = currentUser?.isAnonymous ?? false;

    const usePopup = canUsePopup();

    let result;
    let userId: string;

    if (wasAnonymous && currentUser) {
      // Save anonymous user data before signing out
      if (!usePopup) {
        const userDoc = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) {
          const anonymousData = userSnap.data();
          sessionStorage.setItem('anonymousData', JSON.stringify({
            customizationsUsed: anonymousData.customizationsUsed || 0,
            customizationsAllowed: anonymousData.customizationsAllowed || 0,
            hasListenedToDefault: anonymousData.hasListenedToDefault || false,
          }));
        }
        sessionStorage.setItem('anonymousUid', currentUser.uid);

        // Sign out anonymous user before redirect
        await auth.signOut();
      }

      // Try to link anonymous account with Google (popup only)
      try {
        if (usePopup) {
          result = await linkWithPopup(currentUser, provider);
          userId = result.user.uid;
        } else {
          // Use regular sign-in redirect after signing out
          sessionStorage.setItem('pendingRedirect', 'signin');

          await signInWithRedirect(auth, provider);
          // This line won't be reached - page will redirect
          throw new Error('REDIRECT_IN_PROGRESS');
        }
      } catch (linkError) {
        const firebaseError = linkError as { code?: string; message?: string };

        // If account already exists, sign in with Google instead
        if (firebaseError.code === 'auth/credential-already-in-use') {
          if (usePopup) {
            try {
              result = await signInWithPopup(auth, provider);
              userId = result.user.uid;
            } catch (popupError) {
              const popupFirebaseError = popupError as { code?: string; message?: string };
              // Handle popup blocked or COOP errors
              if (popupFirebaseError.code === 'auth/popup-blocked' ||
                popupFirebaseError.code === 'auth/cancelled-popup-request' ||
                (popupFirebaseError.message && popupFirebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
                await signInWithRedirect(auth, provider);
                throw new Error('REDIRECT_IN_PROGRESS');
              }
              throw popupError;
            }
          } else {
            sessionStorage.setItem('pendingRedirect', 'signin');
            await signInWithRedirect(auth, provider);
            throw new Error('REDIRECT_IN_PROGRESS');
          }
        } else if (firebaseError.code === 'auth/popup-blocked' ||
          firebaseError.code === 'auth/cancelled-popup-request' ||
          firebaseError.code === 'auth/popup-closed-by-user' ||
          (firebaseError.message && firebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
          sessionStorage.setItem('anonymousUid', currentUser.uid);
          sessionStorage.setItem('pendingRedirect', 'signin-fallback');
          await signInWithRedirect(auth, provider);
          throw new Error('REDIRECT_IN_PROGRESS');
        } else {
          throw linkError;
        }
      }
    } else {
      // Regular Google sign-in
      if (usePopup) {
        try {
          result = await signInWithPopup(auth, provider);
          userId = result.user.uid;
        } catch (popupError) {
          const popupFirebaseError = popupError as { code?: string; message?: string };
          // Handle popup blocked, cancelled, or COOP errors
          if (popupFirebaseError.code === 'auth/popup-blocked' ||
            popupFirebaseError.code === 'auth/cancelled-popup-request' ||
            popupFirebaseError.code === 'auth/popup-closed-by-user' ||
            (popupFirebaseError.message && popupFirebaseError.message.includes('Cross-Origin-Opener-Policy'))) {
            sessionStorage.setItem('pendingRedirect', 'signin-fallback');
            await signInWithRedirect(auth, provider);
            throw new Error('REDIRECT_IN_PROGRESS');
          }
          throw popupError;
        }
      } else {
        sessionStorage.setItem('pendingRedirect', 'signin');

        await signInWithRedirect(auth, provider);
        throw new Error('REDIRECT_IN_PROGRESS');
      }
    }

    // Award 3 free customizations for new Google users
    const userDoc = doc(db, 'users', userId);
    const userSnap = await getDoc(userDoc);
    let isNewUser = false;

    if (!userSnap.exists()) {
      isNewUser = true;
      // New user - create with 3 free customizations
      const newUserData = {
        customizationsUsed: 0,
        customizationsAllowed: 3,
        createdAt: new Date(),
        isGoogleUser: true,
      };
      await setDoc(userDoc, newUserData);

      // Verify the write
      const verifySnap = await getDoc(userDoc);
      if (!verifySnap.exists()) {
        console.error('❌ User document creation failed - document does not exist after setDoc');
      }
    } else {
      const currentData = userSnap.data();
      const currentAllowed = currentData.customizationsAllowed || 0;

      // Check if user already has the Google login bonus
      if (currentData.isGoogleUser) {
        isNewUser = false;
      } else {
        // First time logging in with Google - increase customizationsAllowed by 3
        isNewUser = true;
        const newAllowed = currentAllowed + 3;
        await updateDoc(userDoc, {
          customizationsAllowed: newAllowed,
          isGoogleUser: true,
        });

        // Verify the update
        const verifySnap = await getDoc(userDoc);
      }
    }

    return { userId, isNewUser };
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    // Handle redirect in progress (not an error)
    if (firebaseError.message === 'REDIRECT_IN_PROGRESS') {
      throw error; // Pass it up so UI can handle
    }

    // Handle popup cancellation silently (user just closed it or opened multiple)
    if (firebaseError.code === 'auth/popup-closed-by-user' || firebaseError.code === 'auth/cancelled-popup-request') {
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
    const data = userSnap.data();

    // Ensure we return valid numbers even if fields are missing
    return {
      customizationsUsed: typeof data.customizationsUsed === 'number' ? data.customizationsUsed : 0,
      customizationsAllowed: typeof data.customizationsAllowed === 'number' ? data.customizationsAllowed : 0,
      createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      lastCustomizationAt: data.lastCustomizationAt ? data.lastCustomizationAt.toDate() : undefined,
      hasListenedToDefault: data.hasListenedToDefault || false,
    };
  }

  if (!createIfMissing) {
    return {
      customizationsUsed: 0,
      customizationsAllowed: 0,
      createdAt: new Date(),
    };
  }

  // Create new user with default allowance
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
  await setDoc(userDoc, {
    hasListenedToDefault: true,
  }, { merge: true });
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
};

export { app, db, storage, analytics, auth };
