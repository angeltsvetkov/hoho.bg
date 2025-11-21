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
      console.log('✅ Auth persistence set to browserLocalPersistence');
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

    // Check for localhost - use popup for better dev experience
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🌐 Localhost detected, using popup method');
      return true;
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

// Shared promise to prevent double-invocation in Strict Mode
let redirectResultPromise: Promise<UserCredential | null> | null = null;

const getSharedRedirectResult = (authInstance: Auth): Promise<UserCredential | null> => {
  if (!redirectResultPromise) {
    console.log('🔄 Initializing shared redirect result promise...');
    redirectResultPromise = getRedirectResult(authInstance);
  } else {
    console.log('♻️ Reusing existing redirect result promise');
  }
  return redirectResultPromise;
};

// Helper function to check and handle redirect result
export const handleRedirectResult = async (): Promise<{ userId: string; isNewUser: boolean } | null> => {
  try {
    await ensurePersistence();
    console.log('🔍 Checking for redirect result...');

    // Check if we just came back from a redirect
    // The URL will have been cleaned by Firebase, but we can check sessionStorage
    const pendingRedirect = sessionStorage.getItem('pendingRedirect');
    if (pendingRedirect) {
      console.log('📍 Pending redirect detected in session storage');
      sessionStorage.removeItem('pendingRedirect'); // Remove it now to prevent loops

      // First, try getRedirectResult to trigger Firebase to process the auth code
      console.log('⏳ Calling getRedirectResult to trigger Firebase processing...');
      let redirectResult = await getSharedRedirectResult(auth);

      console.log('🔍 Redirect result:', redirectResult ? 'FOUND' : 'NULL');
      console.log('🔍 Current user after getRedirectResult:', {
        uid: auth.currentUser?.uid,
        isAnonymous: auth.currentUser?.isAnonymous,
        provider: auth.currentUser?.providerData?.[0]?.providerId
      });

      // Check if user is already signed in (Firebase processed it before we checked)
      if (!redirectResult && auth.currentUser && !auth.currentUser.isAnonymous) {
        console.log('✅ Firebase already processed redirect - user is signed in!');
        redirectResult = { user: auth.currentUser } as any;
      }

      // If still no result, wait for auth state to change (Firebase processes async)
      if (!redirectResult) {
        console.log('⏳ No immediate result, waiting for Firebase to process redirect...');
        const googleUser = await new Promise<User | null>((resolve) => {
          let timeoutId: NodeJS.Timeout;
          let checkCount = 0;

          const unsubscribe = onAuthStateChanged(auth, (user) => {
            checkCount++;
            console.log(`🔄 Auth state check #${checkCount}:`, {
              uid: user?.uid,
              isAnonymous: user?.isAnonymous,
              provider: user?.providerData?.[0]?.providerId
            });

            // If we get a Google user, resolve immediately
            if (user && !user.isAnonymous) {
              clearTimeout(timeoutId);
              unsubscribe();
              console.log('✅ Google user detected after redirect!');
              resolve(user);
            }
          });

          // Timeout after 10 seconds (increased from 3)
          timeoutId = setTimeout(() => {
            unsubscribe();
            console.log('⏱️ Timeout waiting for Google user after 10 seconds');
            // Last chance: check auth.currentUser one more time
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
              console.log('✅ Found Google user in final check!');
              resolve(auth.currentUser);
            } else {
              resolve(null);
            }
          }, 10000);
        });

        if (googleUser) {
          redirectResult = { user: googleUser } as any;
        }
      } else {
        console.log('✅ Got redirect result immediately!');
      }

      const googleUser = redirectResult?.user;
      // If we got a Google user, process migration
      const anonymousDataStr = sessionStorage.getItem('anonymousData');
      if (googleUser && anonymousDataStr) {
        console.log('✅ User signed in with Google after redirect, processing migration');
        const userId = googleUser.uid;

        sessionStorage.removeItem('anonymousData');
        sessionStorage.removeItem('anonymousUid');

        const oldData = JSON.parse(anonymousDataStr);
        console.log('📦 Saved anonymous data:', oldData);

        // Check if we need to award customizations
        const userDoc = doc(db, 'users', userId);
        const userSnap = await getDoc(userDoc);

        if (!userSnap.exists()) {
          console.log('🆕 New user - creating with migrated data + 3 customizations');
          await setDoc(userDoc, {
            customizationsUsed: oldData.customizationsUsed || 0,
            customizationsAllowed: (oldData.customizationsAllowed || 0) + 3,
            createdAt: new Date(),
            isGoogleUser: true,
            hasListenedToDefault: oldData.hasListenedToDefault || false,
          });
          console.log('✅ User document created successfully with migration');
          return { userId, isNewUser: true };
        } else if (!userSnap.data().isGoogleUser) {
          console.log('🎁 Existing user, awarding Google login bonus');
          const currentAllowed = userSnap.data().customizationsAllowed || 0;
          await updateDoc(userDoc, {
            customizationsAllowed: currentAllowed + 3,
            isGoogleUser: true,
          });
          console.log(`✅ Customizations increased from ${currentAllowed} to ${currentAllowed + 3}`);
          return { userId, isNewUser: true };
        } else {
          console.log('ℹ️ User already has Google login bonus');
          return { userId, isNewUser: false };
        }
      }

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
    } // Close the if (pendingRedirect) block

    // No pending redirect - try normal getRedirectResult
    const result = await getSharedRedirectResult(auth);
    if (result) {
      console.log('✅ Redirect sign-in successful via getRedirectResult');
      const userId = result.user.uid;

      // Check if we need to migrate data from anonymous user
      const anonymousDataStr = sessionStorage.getItem('anonymousData');
      const oldAnonymousUid = sessionStorage.getItem('anonymousUid');

      if (anonymousDataStr) {
        console.log('🔄 Migrating data from saved anonymous session');
        sessionStorage.removeItem('anonymousData');
        sessionStorage.removeItem('anonymousUid');

        const oldData = JSON.parse(anonymousDataStr);
        console.log('📦 Old anonymous user data:', oldData);

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
          console.log('✅ Created new user with migrated data + 3 bonus customizations');
          return { userId, isNewUser: true };
        } else {
          // Existing Google user - just mark as Google user and add bonus
          const currentData = userSnap.data();
          if (!currentData.isGoogleUser) {
            await updateDoc(userDoc, {
              customizationsAllowed: (currentData.customizationsAllowed || 0) + 3,
              isGoogleUser: true,
            });
            console.log('✅ Updated existing Google user with bonus');
            return { userId, isNewUser: true };
          }
          console.log('✅ Updated existing Google user');
          return { userId, isNewUser: false };
        }
      } else if (oldAnonymousUid) {
        // Fallback: try to get data from Firestore
        console.log('🔄 Migrating data from anonymous user:', oldAnonymousUid);
        sessionStorage.removeItem('anonymousUid');

        // Get old anonymous user data
        const oldUserDoc = doc(db, 'users', oldAnonymousUid);
        const oldUserSnap = await getDoc(oldUserDoc);

        if (oldUserSnap.exists()) {
          const oldData = oldUserSnap.data();
          console.log('📦 Old anonymous user data:', oldData);

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
            console.log('✅ Created new user with migrated data + 3 bonus customizations');
            return { userId, isNewUser: true };
          } else {
            // Existing Google user - just mark as Google user
            await updateDoc(userDoc, {
              isGoogleUser: true,
            });
            console.log('✅ Updated existing Google user');
            return { userId, isNewUser: false };
          }
        }
      }

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
          console.log('💾 Saved anonymous data for migration:', anonymousData);
        }
        sessionStorage.setItem('anonymousUid', currentUser.uid);
        console.log('💾 Stored anonymous UID for data migration:', currentUser.uid);

        // Sign out anonymous user before redirect
        await auth.signOut();
        console.log('🚪 Signed out anonymous user before redirect');
      }

      // Try to link anonymous account with Google (popup only)
      console.log('🔗 Attempting to link anonymous account with Google...');
      try {
        if (usePopup) {
          result = await linkWithPopup(currentUser, provider);
          userId = result.user.uid;
          console.log('✅ Accounts linked successfully via popup');
        } else {
          // Use regular sign-in redirect after signing out
          console.log('🔄 Redirecting to Google sign-in...');
          sessionStorage.setItem('pendingRedirect', 'signin');

          await signInWithRedirect(auth, provider);
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
    const data = userSnap.data();
    console.log('📖 Retrieved user data:', { userId, customizationsAllowed: data.customizationsAllowed, customizationsUsed: data.customizationsUsed });

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
