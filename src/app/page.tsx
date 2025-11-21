"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { storage, db, auth, getUserData, canUserCustomize, incrementCustomizationCount, markDefaultMessageListened, signInWithGoogle, awardReferralBonus, handleRedirectResult } from "@/lib/firebase";
import { initializeAnalyticsWithConsent, setAnalyticsConsent, trackPageView, trackAudioPlay, trackCustomization, trackShare, trackPurchaseIntent } from "@/lib/analytics";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";

type TimeLeft = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

const getNextChristmas = (reference: Date) => {
  const year = reference.getFullYear();
  const christmasThisYear = new Date(year, 11, 25, 0, 0, 0);
  const dayAfterChristmas = new Date(year, 11, 26, 0, 0, 0);

  if (reference >= dayAfterChristmas) {
    return new Date(year + 1, 11, 25, 0, 0, 0);
  }

  return christmasThisYear;
};

const calculateTimeLeft = (targetDate: Date): TimeLeft => {
  const now = new Date();
  const difference = targetDate.getTime() - now.getTime();
  const clamped = Math.max(difference, 0);

  const days = Math.floor(clamped / MS_IN_DAY);
  const hours = Math.floor((clamped % MS_IN_DAY) / MS_IN_HOUR);
  const minutes = Math.floor((clamped % MS_IN_HOUR) / MS_IN_MINUTE);
  const seconds = Math.floor((clamped % MS_IN_MINUTE) / MS_IN_SECOND);

  return {
    totalMs: difference,
    days,
    hours,
    minutes,
    seconds,
  };
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [targetDate, setTargetDate] = useState(() => getNextChristmas(new Date()));
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(getNextChristmas(new Date())),
  );
  const initialMessage = `Хо хо хо! Остават ${calculateTimeLeft(getNextChristmas(new Date())).days} дни до Коледа!`;
  const [message, setMessage] = useState(initialMessage);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempMessage, setTempMessage] = useState(message);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioCache, setAudioCache] = useState<Map<string, string>>(new Map());
  const [lastGeneratedAudioUrl, setLastGeneratedAudioUrl] = useState<string | null>(null);
  const [showPlayPrompt, setShowPlayPrompt] = useState(false);
  const [initialSpeechFile, setInitialSpeechFile] = useState<string | null>(null);
  const [isCustomMessage, setIsCustomMessage] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [hasListened, setHasListened] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [customizationsRemaining, setCustomizationsRemaining] = useState<number | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  // isAnonymous removed, we rely on currentUserId to determine auth state
  const [userProfile, setUserProfile] = useState<{ photoURL: string | null; displayName: string | null } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isReferralCopied, setIsReferralCopied] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  const handlePurchase = async (customizations: number, price: number) => {
    if (!currentUserId) {
      alert('Моля, изчакайте да се зареди страницата напълно.');
      return;
    }

    setIsProcessingPurchase(true);
    trackPurchaseIntent(customizations, price);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customizations,
          userId: currentUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Възникна грешка. Моля, опитайте отново.');
      setIsProcessingPurchase(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      await auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Грешка при излизане от профила.');
    }
  };

  useEffect(() => {
    setMounted(true);
    // Initialize analytics with consent
    initializeAnalyticsWithConsent();
    // Track page view
    trackPageView('/');
    // Check if user has already accepted cookies
    const cookiesAccepted = localStorage.getItem('cookiesAccepted');
    if (!cookiesAccepted) {
      setShowCookieBanner(true);
    }

    // Check for purchase success/cancel in URL
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const customizations = urlParams.get('customizations');

    if (success === 'true' && customizations) {
      alert(`🎉 Благодарим за покупката! Добавени са ${customizations} персонализации към вашия акаунт!`);
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (canceled === 'true') {
      alert('❌ Плащането беше отменено. Опитайте отново, когато сте готови!');
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleAcceptCookies = (enableAnalytics: boolean) => {
    localStorage.setItem('cookiesAccepted', 'true');
    setAnalyticsConsent(enableAnalytics);
    setShowCookieBanner(false);
    if (enableAnalytics) {
      // Track page view after consent
      trackPageView('/');
    }
  };

  const handleOpenEditor = async () => {
    if (!currentUserId) {
      try {
        const { userId } = await signInWithGoogle();
        setCurrentUserId(userId);
      } catch (error) {
        console.error("Login failed", error);
      }
      return;
    }

    if (customizationsRemaining === 0) {
      setIsPurchaseModalOpen(true);
    } else {
      setTempMessage(message);
      setIsModalOpen(true);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!currentUserId || typeof window === 'undefined') {
      alert('Моля, влезте в профила си, за да поканите приятел.');
      return;
    }
    setIsReferralModalOpen(true);
  };

  const handleCopyReferralLinkFromModal = async () => {
    if (!currentUserId || typeof window === 'undefined') return;

    const referralLink = `${window.location.origin}?ref=${currentUserId}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = referralLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      setIsReferralCopied(true);
      setTimeout(() => setIsReferralCopied(false), 2000);
    } catch (copyError) {
      console.error('❌ Error copying referral link:', copyError);
      alert('Не успяхме да копираме линка. Опитайте отново.');
    }
  };

  const processReferralBonus = async (userId: string) => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const referrerId = urlParams.get('ref');
    if (!referrerId || referrerId === userId) {
      return;
    }

    const storageKey = `referral_processed_${userId}_${referrerId}`;
    if (localStorage.getItem(storageKey) === 'true') {
      console.log('ℹ️ Referral already processed for this user.');
      return;
    }

    try {
      await awardReferralBonus(referrerId, userId);
      localStorage.setItem(storageKey, 'true');
      alert('🎉 Благодарим! Подари 5 персонализации на твоя приятел.');
    } catch (error) {
      console.error('❌ Error processing referral:', error);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  };

  // Sign in anonymously on page load and load user data
  const authInitialized = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (authInitialized.current) return;
    authInitialized.current = true;

    const initAuth = async () => {
      try {
        console.log('🚀 Starting auth initialization...');
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 URL Search Params:', window.location.search);
        console.log('🚦 isAuthLoading:', isAuthLoading);
        console.log('👤 isAnonymous: N/A');

        // Check if we're coming back from a redirect BEFORE checking auth state
        const pendingRedirect = sessionStorage.getItem('pendingRedirect');
        if (pendingRedirect) {
          console.log('🚫 Redirect pending - processing immediately...');

          // Handle redirect FIRST, before waiting for auth state
          const redirectResult = await handleRedirectResult();
          if (redirectResult) {
            console.log('✅ Redirect sign-in complete:', redirectResult);
            // Update UI state
            setCurrentUserId(redirectResult.userId);

            const user = auth.currentUser;
            if (user) {
              setUserProfile({
                photoURL: user.photoURL,
                displayName: user.displayName,
              });
            }

            const userData = await getUserData(redirectResult.userId, false);
            setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);

            // Show success message
            if (redirectResult.isNewUser) {
              alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
            }

            return; // Skip the rest since we handled the Google user
          }
        }

        console.log('⏳ Waiting for auth state...');
        const authUser = await new Promise<User | null>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            console.log('🔐 onAuthStateChanged fired:', {
              uid: user?.uid,
              isAnonymous: user?.isAnonymous,
              displayName: user?.displayName,
              photoURL: user?.photoURL,
              email: user?.email,
              providerId: user?.providerData?.[0]?.providerId,
            });
            unsubscribe();
            resolve(user);
          });
        });

        // If no pending redirect, check for redirect result after auth state settles
        if (!pendingRedirect) {
          const redirectResult = await handleRedirectResult();
          if (redirectResult) {
            console.log('✅ Redirect sign-in complete:', redirectResult);
            // Update UI state
            setCurrentUserId(redirectResult.userId);

            const user = auth.currentUser;
            if (user) {
              setUserProfile({
                photoURL: user.photoURL,
                displayName: user.displayName,
              });
            }

            const userData = await getUserData(redirectResult.userId, false);
            setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);

            // Show success message
            if (redirectResult.isNewUser) {
              alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
            }

            return; // Skip the rest since we handled the Google user
          }
        }

        console.log('🔐 Auth state restored:', {
          uid: authUser?.uid,
          isAnonymous: authUser?.isAnonymous,
          displayName: authUser?.photoURL,
          photoURL: authUser?.photoURL,
        });

        // Set user profile if logged in with Google
        if (authUser && !authUser.isAnonymous) {
          const profileData = {
            photoURL: authUser.photoURL,
            displayName: authUser.displayName,
          };
          console.log('👤 Setting user profile:', profileData);
          setUserProfile(profileData);
          setCurrentUserId(authUser.uid);
          console.log('✅ User profile set for Google user, isAnonymous=false');

          const userData = await getUserData(authUser.uid);
          setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);
          if (userData.hasListenedToDefault) {
            setHasListened(true);
          }

          await processReferralBonus(authUser.uid);

          await processReferralBonus(authUser.uid);

        } else {
          // No user logged in
          console.log('👤 No user logged in');
          setCurrentUserId(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();
  }, [mounted]);

  // Listen to auth state changes to keep isAnonymous in sync
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !user.isAnonymous) {
        console.log('🔄 Auth state changed: Google user detected', {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email
        });
        setUserProfile({
          photoURL: user.photoURL,
          displayName: user.displayName,
        });
        console.log('✅ Avatar URL set:', user.photoURL);
      } else {
        console.log('🔄 Auth state changed: No user');
        setCurrentUserId(null);
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.profile-menu-container')) {
          setShowProfileMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // Play the pre-recorded speech on page load
  useEffect(() => {
    if (!mounted) return;

    const playInitialSpeech = async () => {
      const daysRemaining = timeLeft.days;
      const speechFile = `/speech/${daysRemaining}.mp3`;
      setInitialSpeechFile(speechFile);

      try {
        const audio = new Audio(speechFile);
        await audio.play();
        setShowPlayPrompt(false);
        setHasListened(true);

        // Mark as listened in Firestore if logged in
        if (currentUserId) {
          await markDefaultMessageListened(currentUserId);
        }
      } catch (error) {
        if ((error as Error).name === 'NotAllowedError') {
          // Show play prompt button when autoplay is blocked
          setShowPlayPrompt(true);
        } else {
          console.error('Error playing initial speech:', error);
        }
      }
    };

    playInitialSpeech();
  }, [mounted, timeLeft.days]);

  const handlePlayPrompt = async () => {
    if (!initialSpeechFile) return;

    try {
      const audio = new Audio(initialSpeechFile);
      await audio.play();
      setShowPlayPrompt(false);
      setHasListened(true);

      // Mark as listened in Firestore
      try {
        if (currentUserId) {
          await markDefaultMessageListened(currentUserId);
        }
      } catch (error) {
        console.error('Error marking default message as listened:', error);
      }
    } catch (error) {
      console.error('Error playing speech:', error);
    }
  };

  const handleShare = async () => {
    if (!shareableUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Коледно послание',
          text: message,
          url: shareableUrl,
        });
        trackShare('native');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareableUrl);
        trackShare('copy');
        alert('Линкът е копиран! 🎉');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleShareFacebook = () => {
    if (!shareableUrl) return;

    trackShare('facebook');
    const url = encodeURIComponent(shareableUrl);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(facebookUrl, '_blank', 'width=600,height=600');
  };

  const playTextToSpeech = async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    setHasListened(true);

    // Mark as listened in Firestore if playing default message
    if (!isCustomMessage && currentUserId) {
      try {
        await markDefaultMessageListened(currentUserId);
      } catch (error) {
        console.error('Error marking default message as listened:', error);
      }
    }

    try {
      let audioUrl: string;

      // If message is not customized, play the predefined MP3
      if (!isCustomMessage && initialSpeechFile) {
        trackAudioPlay('default', timeLeft.days);
        const audio = new Audio(initialSpeechFile);

        audio.onended = () => {
          setIsPlaying(false);
        };

        audio.onerror = () => {
          setIsPlaying(false);
        };

        await audio.play();
        return;
      }

      // For custom messages, check cache or generate new audio
      if (audioCache.has(message)) {
        audioUrl = audioCache.get(message)!;
      } else {
        // Generate new audio
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: message }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);

        // Cache the audio URL
        setAudioCache(prev => new Map(prev).set(message, audioUrl));
        setLastGeneratedAudioUrl(audioUrl);
      }

      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing speech:', error);
      setIsPlaying(false);
    }
  };

  const generateAndPlayNewSpeech = async (textToSpeak?: string) => {
    if (isGenerating || isPlaying) return;

    const messageText = textToSpeak || message;

    setIsGenerating(true);
    try {
      if (!currentUserId) {
        // Should be handled by UI, but double check
        const { userId } = await signInWithGoogle();
        setCurrentUserId(userId);
        return; // Let them try again after login
      }

      const userId = currentUserId;

      // Check if user can customize
      const canCustomize = await canUserCustomize(userId);
      if (!canCustomize) {
        alert('Достигнахте максималния брой персонализации. Моля, опитайте отново утре! 🎅');
        setIsGenerating(false);
        return;
      }

      setIsCustomMessage(true); // Mark as custom message

      // Always generate new audio, ignore cache
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: messageText }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Upload to Firebase Storage
      try {
        const timestamp = Date.now();
        const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `speech/${uniqueId}.mp3`;
        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, audioBlob);
        const firebaseUrl = await getDownloadURL(storageRef);

        // Save message data to Firestore
        const messageDoc = doc(db, "sharedMessages", uniqueId);
        await setDoc(messageDoc, {
          text: messageText,
          audioUrl: firebaseUrl,
          createdAt: timestamp,
        });

        console.log('Audio uploaded to Firebase:', firebaseUrl);

        // Generate shareable URL
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = `${baseUrl}/share/${uniqueId}`;
        setShareableUrl(shareUrl);

        // Increment customization count
        await incrementCustomizationCount(userId);
        const userData = await getUserData(userId);
        setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);

        // Use Firebase URL for download/share
        setLastGeneratedAudioUrl(firebaseUrl);
      } catch (uploadError) {
        console.error('Error uploading to Firebase:', uploadError);
        // Fallback to blob URL if upload fails
        setLastGeneratedAudioUrl(audioUrl);
        setShareableUrl(null);
      }

      // Update cache with blob URL for playback
      setAudioCache(prev => new Map(prev).set(messageText, audioUrl));

      // Track customization
      trackAudioPlay('custom');

      setIsGenerating(false);
      setIsPlaying(true);

      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      await audio.play();
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsGenerating(false);
    }
  };



  // Cleanup cached audio URLs when component unmounts
  useEffect(() => {
    return () => {
      audioCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioCache]);

  useEffect(() => {
    const updateTimer = () => {
      const nextTarget = getNextChristmas(new Date());

      if (nextTarget.getTime() !== targetDate.getTime()) {
        setTargetDate(nextTarget);
        setTimeLeft(calculateTimeLeft(nextTarget));
      } else {
        setTimeLeft(calculateTimeLeft(targetDate));
      }
    };

    const intervalId = window.setInterval(updateTimer, MS_IN_SECOND);
    updateTimer();

    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfileMenu && !target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const countdownValues = [
    { label: "Дни", value: timeLeft.days },
    { label: "Часa", value: timeLeft.hours },
    { label: "Минути", value: timeLeft.minutes },
    { label: "Секунди", value: timeLeft.seconds },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#ffeef7] via-[#fff9f2] to-[#f0f8ff] px-6 py-12 text-[#2b1830] animate-gradient" style={{ backgroundSize: '200% 200%' }}>
      {/* Animated Gradient Overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,220,240,0.6),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(240,248,255,0.6),transparent_50%)] opacity-80"
      />

      {/* Snowfall Effect */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white opacity-70 animate-snowfall"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10vh`,
              fontSize: `${Math.random() * 10 + 10}px`,
              animationDuration: `${Math.random() * 10 + 15}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Auth Loading State */}
      {isAuthLoading && (
        <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div className="flex items-center gap-2 rounded-full border-2 border-white bg-white p-1 shadow-lg sm:gap-3 sm:p-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white sm:size-10">
              <svg className="size-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <span className="hidden text-sm font-bold text-[#d91f63] sm:inline">Зареждане...</span>
          </div>
        </div>
      )}

      {/* Promotional message - Invite a friend (hidden on mobile) */}
      {!isAuthLoading && currentUserId && (
        <div className="fixed left-4 top-20 z-50 hidden sm:left-6 sm:top-6 sm:block">
          <button
            onClick={handleCopyReferralLink}
            className="group flex items-center gap-3 rounded-3xl border-2 border-white bg-linear-to-r from-[#f9d423] via-[#ff4e50] to-[#d91f63] px-4 py-2 text-left text-white shadow-[0_15px_40px_-20px_rgba(217,31,99,0.9)] transition hover:scale-105"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-white/20 text-2xl">🎁</div>
            <div className="leading-tight">
              <p className="text-xs font-black uppercase tracking-wider text-white/80">Покани приятел</p>
              <p className="text-sm font-black">
                {isReferralCopied ? '✅ Линкът е копиран' : '+5 персонализации'}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Combined header badge - user profile + customizations */}
      {!isAuthLoading && currentUserId && (
        <div className="profile-menu-container fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div className="flex flex-col items-end gap-3">
            <div className="relative">
              <div className="flex items-center gap-2 rounded-full border-2 border-white bg-white p-1 shadow-lg sm:gap-3 sm:p-2">
                {/* User profile section */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 rounded-full transition hover:opacity-80"
                  >
                    {userProfile?.photoURL ? (
                      <Image
                        src={userProfile.photoURL}
                        alt={userProfile.displayName || 'User'}
                        width={40}
                        height={40}
                        className="size-8 rounded-full object-cover sm:size-10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white sm:size-10">
                        <span className="text-lg font-bold sm:text-xl">
                          {userProfile?.displayName?.[0]?.toUpperCase() || '👤'}
                        </span>
                      </div>
                    )}
                    <svg className={`size-4 text-[#d91f63] transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border-2 border-white bg-white shadow-xl ring-1 ring-black/5">
                      <div className="p-1">
                        {/* Invite a friend option (mobile only) */}
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleCopyReferralLink();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#d91f63] transition hover:bg-pink-50 sm:hidden"
                        >
                          <span className="text-base">🎁</span>
                          <div className="flex-1 text-left">
                            <div className="text-xs font-black uppercase tracking-wider text-[#d91f63]/70">Покани приятел</div>
                            <div className="text-sm font-black">+5 персонализации</div>
                          </div>
                        </button>

                        {/* Logout option */}
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-50"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Изход
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-[#ffd7ec] sm:h-10"></div>

                {/* Customizations counter section */}
                <button
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="flex items-center gap-2 transition hover:opacity-80"
                >
                  {customizationsRemaining === null ? (
                    <span className="flex size-7 animate-pulse items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-400 sm:size-8">...</span>
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-base font-black text-white sm:size-8 sm:text-lg">
                      {isNaN(customizationsRemaining) ? '0' : customizationsRemaining}
                    </span>
                  )}
                  {customizationsRemaining === 0 && (
                    <span className="ml-2 rounded-full bg-[#d91f63] px-2 py-1 text-xs font-bold text-white shadow-sm sm:text-sm">
                      💳 Купи
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login button for non-authenticated users */}
      {!isAuthLoading && !currentUserId && (
        <button
          onClick={async () => {
            try {
              console.log('🔄 Starting Google sign-in process...');
              const { userId, isNewUser } = await signInWithGoogle();
              console.log('✅ Sign-in complete, user ID:', userId);
              setCurrentUserId(userId);

              // Set user profile
              const user = auth.currentUser;
              if (user) {
                setUserProfile({
                  photoURL: user.photoURL,
                  displayName: user.displayName,
                });
              }

              console.log('📊 Fetching user data...');
              const userData = await getUserData(userId, false);
              console.log('📦 User data:', userData);
              const remaining = userData.customizationsAllowed - userData.customizationsUsed;
              console.log('🎁 Customizations remaining:', remaining);
              setCustomizationsRemaining(remaining);

              // Only show success message if user is new (received customizations)
              if (isNewUser) {
                alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
              }
            } catch (error) {
              const typedError = error as { message?: string };
              if (typedError?.message === 'REDIRECT_IN_PROGRESS') return;
              if (typedError?.message === 'POPUP_CANCELLED') return;
              console.error('❌ Login failed:', error);
              alert(typedError?.message || 'Неуспешен вход. Моля, опитайте отново.');
            }
          }}
          className="fixed right-4 top-4 z-50 transition hover:scale-105 sm:right-6 sm:top-6"
        >
          <div className="flex items-center gap-2 rounded-full border-2 border-white bg-white p-1 shadow-lg sm:gap-3 sm:p-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white sm:size-10">
              <span className="text-lg font-bold sm:text-xl">🎁</span>
            </div>
            <span className="hidden text-sm font-bold text-[#d91f63] sm:inline">Вход за 3 безплатни</span>
            <span className="text-xs font-bold text-[#d91f63] sm:hidden">Вход</span>
          </div>
        </button>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-8">
          {/* Santa Image */}
          <div className="w-64 shrink-0 drop-shadow-[0_30px_80px_rgba(220,53,119,0.4)] sm:w-80 lg:w-96 animate-float">
            <Image
              src="/santa.png"
              alt="Весело лице на Дядо Коледа"
              width={512}
              height={512}
              priority
              className="animate-wiggle transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_40px_rgba(249,212,35,0.3)]"
            />
          </div>

          {/* Message Bubble and Action Button */}
          <div className="flex w-full flex-col items-center gap-4 lg:flex-1">
            <div className="relative w-full max-w-md rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] px-8 py-6 text-center shadow-[0_30px_90px_-30px_rgba(178,24,77,0.4)]">
              {isCustomMessage && (
                <>
                  <button
                    onClick={handleOpenEditor}
                    className="absolute -left-4 -top-4 flex size-12 items-center justify-center rounded-full bg-white text-2xl shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] transition hover:scale-110 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]"
                    aria-label="Редактирай послание"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={showPlayPrompt ? handlePlayPrompt : playTextToSpeech}
                    disabled={isPlaying}
                    className={`absolute -right-4 -top-4 flex size-12 items-center justify-center rounded-full text-2xl transition hover:scale-110 disabled:opacity-50 disabled:hover:scale-100 ${showPlayPrompt
                      ? 'animate-pulse-scale bg-[#ff5a9d] text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)]'
                      : 'bg-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]'
                      }`}
                    aria-label="Чуй посланието"
                  >
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                </>
              )}
              {!isCustomMessage && hasListened && (
                <button
                  onClick={showPlayPrompt ? handlePlayPrompt : playTextToSpeech}
                  disabled={isPlaying}
                  className={`absolute -right-4 -top-4 flex size-12 items-center justify-center rounded-full text-2xl transition hover:scale-110 disabled:opacity-50 disabled:hover:scale-100 ${showPlayPrompt
                    ? 'animate-pulse-scale bg-[#ff5a9d] text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)]'
                    : 'bg-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]'
                    }`}
                  aria-label="Чуй посланието"
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>
              )}
              <p
                onClick={!isCustomMessage ? handleOpenEditor : undefined}
                className={`text-2xl font-black leading-relaxed text-[#d91f63] ${!isCustomMessage ? 'cursor-pointer transition hover:scale-105' : ''}`}
              >
                {message}
              </p>
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center rounded-4xl bg-white/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 animate-spin rounded-full border-4 border-[#ffd7ec] border-t-[#ff5a9d]"></div>
                    <p className="text-sm font-bold text-[#d91f63]">Подготвяме гласа...</p>
                  </div>
                </div>
              )}
            </div>
            {!isCustomMessage && (
              <button
                onClick={hasListened ? handleOpenEditor : (showPlayPrompt ? handlePlayPrompt : playTextToSpeech)}
                className="group relative w-full max-w-sm flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-4 text-base font-black text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)] transition-all duration-300 hover:scale-105 hover:shadow-[0_30px_80px_-10px_rgba(220,53,119,1)] animate-pulse-scale"
                style={{ fontFamily: 'Poppins, sans-serif' }}
                aria-label={hasListened ? "Персонализирай посланието" : "Чуй посланието на Дядо Коледа"}
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                <span className="relative z-10 text-xl">{hasListened ? '✏️' : '🔊'}</span>
                <span className="relative z-10">{hasListened ? 'Персонализирай посланието' : 'Чуй посланието на Дядо Коледа'}</span>
              </button>
            )}
            {isCustomMessage && lastGeneratedAudioUrl && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-3">
                  {shareableUrl && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareableUrl);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-linear-to-br from-[#ffd7ec] to-[#ffb3d9] px-6 py-3 text-base font-black uppercase tracking-wider text-[#d91f63] shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgба(220,53,119,0.7)]"
                    >
                      {isCopied ? '✅ Копирано!' : '📋 Копирай линк'}
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-6 py-3 text-base font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgба(220,53,119,0.7)] md:hidden"
                  >
                    🎁 Сподели
                  </button>
                  <button
                    onClick={handleShareFacebook}
                    className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-[#1877f2] px-6 py-3 text-base font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(24,119,242,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgба(24,119,242,0.7)]"
                  >
                    <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] p-8 shadow-[0_40px_120px_-40px_rgba(178,24,77,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 text-center text-3xl font-black text-[#d91f63]">
              Напиши послание ✨
            </h2>
            <textarea
              value={tempMessage}
              maxLength={100}
              onChange={(e) => setTempMessage(e.target.value)}
              className="mb-2 w-full rounded-3xl border-4 border-[#ffd7ec] bg-white px-6 py-4 text-center text-xl font-bold text-[#d91f63] placeholder-[#f0a8c5] outline-none transition focus:border-[#ff5a9d] focus:ring-4 focus:ring-[#ffc8e0]"
              placeholder="Хо хо хо!"
              rows={3}
              autoFocus
            />
            <div className="mb-6 text-center text-sm font-bold text-[#d91f63]/60">
              {100 - tempMessage.length} символа остават
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-3xl border-4 border-[#ffd7ec] bg-white px-6 py-4 text-lg font-black uppercase tracking-wider text-[#d91f63] transition hover:bg-[#fff5fa]"
              >
                Отказ
              </button>
              <button
                onClick={() => {
                  setMessage(tempMessage);
                  setIsModalOpen(false);
                  trackCustomization(tempMessage.length);
                  // Generate and play new speech immediately after saving
                  setTimeout(() => generateAndPlayNewSpeech(tempMessage), 100);
                }}
                disabled={isGenerating}
                className="flex-1 rounded-3xl border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-6 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:shadow-[0_25px_70px_-20px_rgба(220,53,119,0.7)] disabled:opacity-50"
              >
                Запази
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {isReferralModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
          onClick={() => {
            setIsReferralModalOpen(false);
            setIsReferralCopied(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] p-8 shadow-[0_40px_120px_-40px_rgba(178,24,77,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-3xl font-black text-[#d91f63]">
              🎁 Покани приятел
            </h2>
            <p className="mb-6 text-center text-base font-bold text-[#d91f63]/80 sm:text-lg">
              Получи 5 безплатни персонализации за всеки приятел, който се регистрира!
            </p>

            <div className="mb-6 space-y-4 rounded-2xl bg-white/50 p-6">
              <h3 className="text-lg font-black text-[#d91f63]">📋 Как работи:</h3>
              <ul className="space-y-2 text-sm font-bold text-[#d91f63]/80">
                <li className="flex items-start gap-2">
                  <span className="text-base">1️⃣</span>
                  <span>Копирай твоя уникален линк за покана</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base">2️⃣</span>
                  <span>Сподели го с приятели във Facebook, WhatsApp или имейл</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base">3️⃣</span>
                  <span>Когато приятел се регистрира чрез твоя линк, и двамата получавате бонус</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base">🎉</span>
                  <span>Ти получаваш <strong>5 персонализации</strong>, а приятелят ти получава <strong>3 персонализации</strong> при регистрация</span>
                </li>
              </ul>
            </div>

            <div className="mb-6 space-y-3">
              <label className="block text-sm font-black text-[#d91f63]">
                Твоят линк за покана:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentUserId ? `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${currentUserId}` : ''}
                  className="flex-1 rounded-xl border-2 border-[#ffd7ec] bg-white px-4 py-3 text-sm font-bold text-[#d91f63] focus:border-[#ff5a9d] focus:outline-none"
                />
                <button
                  onClick={handleCopyReferralLinkFromModal}
                  className="rounded-xl border-2 border-white bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-3 font-black text-white shadow-lg transition hover:scale-105"
                >
                  {isReferralCopied ? '✅ Копиран' : '📋 Копирай'}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setIsReferralModalOpen(false);
                setIsReferralCopied(false);
              }}
              className="w-full rounded-2xl border-2 border-[#d91f63] bg-white py-3 font-black text-[#d91f63] transition hover:bg-[#fff0f8]"
            >
              Затвори
            </button>
          </div>
        </div>
      )}

      {isPurchaseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm"
          onClick={() => setIsPurchaseModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] p-8 shadow-[0_40px_120px_-40px_rgba(178,24,77,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-3xl font-black text-[#d91f63]">
              Купи персонализации 🎅
            </h2>
            <p className="mb-8 text-center text-base font-bold text-[#d91f63]/80 sm:text-lg">
              Купи персонализации, за да създаваш магични коледни послания.
            </p>

            <div className="mb-6 space-y-5">
              {!currentUserId && (
                <button
                  onClick={async () => {
                    try {
                      setIsPurchaseModalOpen(false);
                      console.log('🔄 Starting Google sign-in process...');
                      const { userId, isNewUser } = await signInWithGoogle();
                      console.log('✅ Sign-in complete, user ID:', userId);
                      setCurrentUserId(userId);

                      // Set user profile
                      const user = auth.currentUser;
                      if (user) {
                        setUserProfile({
                          photoURL: user.photoURL,
                          displayName: user.displayName,
                        });
                      }

                      console.log('📊 Fetching user data...');
                      const userData = await getUserData(userId, false);
                      console.log('📦 User data:', userData);
                      const remaining = userData.customizationsAllowed - userData.customizationsUsed;
                      console.log('🎁 Customizations remaining:', remaining);
                      setCustomizationsRemaining(remaining);

                      // Only show success message if user is new (received customizations)
                      if (isNewUser) {
                        alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
                      }
                    } catch (error) {
                      const typedError = error as { message?: string };
                      if (typedError?.message === 'REDIRECT_IN_PROGRESS') return;
                      if (typedError?.message === 'POPUP_CANCELLED') return;
                      console.error('❌ Login failed:', error);
                      alert(typedError?.message || 'Неуспешен вход. Моля, опитайте отново.');
                    }
                  }}
                  className="group relative block w-full overflow-hidden rounded-3xl border-4 border-white bg-linear-to-br from-[#ff0066] via-[#ff3388] to-[#d91f63] px-6 pb-8 pt-16 text-center shadow-[0_30px_100px_-25px_rgba(255,0,102,0.9)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_40px_120px_-20px_rgба(255,0,102,1)] sm:px-8 sm:pb-10 sm:pt-20">
                  {/* Decorative ribbons */}
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-4 -translate-x-1/2 bg-linear-to-b from-white/50 via-white/40 to-white/50 shadow-inner" aria-hidden />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 bg-linear-to-r from-white/50 via-white/40 to-white/50 shadow-inner" aria-hidden />

                  Gift bow
                  <div className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 drop-shadow-lg sm:top-8" aria-hidden>
                    <span className="h-8 w-8 -rotate-12 rounded-3xl border-3 border-white/90 bg-white/50 shadow-md sm:h-10 sm:w-10" />
                    <span className="h-8 w-8 rotate-12 rounded-3xl border-3 border-white/90 bg-white/50 shadow-md sm:h-10 sm:w-10" />
                    <span className="h-5 w-5 rounded-full border-2 border-white bg-white shadow-md sm:h-6 sm:w-6" />
                  </div>

                  {/* Content */}
                  <div className="relative z-10 space-y-3">
                    <div className="text-4xl font-black leading-tight text-white drop-shadow-lg sm:text-5xl">
                      Влез с Google
                    </div>
                    <div className="mx-auto flex max-w-sm items-center justify-center gap-2 text-2xl font-black text-white/95 drop-shadow-md sm:text-3xl">
                      <span className="text-3xl sm:text-4xl">🎅</span>
                      <span>3 персонализации</span>
                    </div>
                    <div className="text-base font-bold text-white/90 drop-shadow sm:text-lg">
                      Специален коледен подарък за теб!
                    </div>

                    {/* CTA emphasis */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider text-white/80 sm:text-base">
                      <span className="animate-bounce">👉</span>
                      <span>Кликни тук</span>
                      <span className="animate-bounce">👈</span>
                    </div>
                  </div>

                  {/* Sparkle effects */}
                  <div className="pointer-events-none absolute right-6 top-8 animate-pulse text-2xl opacity-80 sm:text-3xl" aria-hidden>✨</div>
                  <div className="pointer-events-none absolute bottom-6 left-8 animate-pulse text-xl opacity-70 delay-300 sm:text-2xl" aria-hidden>⭐</div>
                  <div className="pointer-events-none absolute bottom-8 right-10 animate-pulse text-xl opacity-75 delay-500 sm:text-2xl" aria-hidden>💫</div>
                </button>
              )}

              <button
                onClick={() => handlePurchase(10, 3)}
                disabled={isProcessingPurchase}
                className="relative block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-5 pb-6 pt-12 text-center shadow-[0_25px_80px_-20px_rgба(220,53,119,0.8)] transition hover:scale-105 hover:shadow-[0_30px_90px_-15px_rgба(220,53,119,0.9)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-6">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 sm:-translate-y-1/3">
                  <span className="rounded-full bg-[#00ff00] px-4 py-1 text-xs font-black text-[#d91f63] shadow-lg animate-pulse-scale sm:text-sm">
                    Най-изгодно! 🎁
                  </span>
                </div>
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isProcessingPurchase ? 'Зареждане...' : '10 Персонализации'}
                </div>
                <div className="mt-2 text-base font-bold text-white/90 sm:text-xl">3 лв</div>
                <div className="mt-1 text-xs font-bold text-white/70 sm:text-sm">Само 0.30 лв на персонализация</div>
              </button>

              <button
                onClick={() => handlePurchase(3, 2)}
                disabled={isProcessingPurchase}
                className="block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ff85b8] to-[#ff5a9d] px-5 py-5 text-center shadow-[0_20px_60px_-25px_rgба(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgба(220,53,119,0.7)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-4">
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isProcessingPurchase ? 'Зареждане...' : '3 Персонализации'}
                </div>
                <div className="mt-1 text-base font-bold text-white/90 sm:text-lg">2 лв</div>
              </button>

              <button
                onClick={() => handlePurchase(1, 1)}
                disabled={isProcessingPurchase}
                className="block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ffb3d9] to-[#ff85b8] px-5 py-5 text-center shadow-[0_20px_60px_-25px_rgба(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgба(220,53,119,0.7)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-4">
                <div className="text-2xl font-black text-white sm:text-3xl">
                  {isProcessingPurchase ? 'Зареждане...' : '1 Персонализация'}
                </div>
                <div className="mt-1 text-base font-bold text-white/90 sm:text-lg">1 лв</div>
              </button>
            </div>

            <button
              onClick={() => setIsPurchaseModalOpen(false)}
              className="w-full rounded-3xl border-4 border-white bg-white px-6 py-3 text-base font-black uppercase tracking-wider text-[#d91f63] shadow-lg transition hover:bg-[#fff0f8]"
            >
              Затвори
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-4xl mt-12">
        <div className="mb-6 text-center animate-fadeInUp">
          <h1 className="text-5xl font-black tracking-tight text-[#d91f63] sm:text-6xl md:text-7xl drop-shadow-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
            До Коледа остават
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {countdownValues.map(({ label, value }, index) => (
            <div
              key={label}
              className="group relative rounded-4xl border-4 border-white/30 bg-gradient-to-br from-[#ff85b8]/90 to-[#ff5a9d]/90 p-8 text-center shadow-[0_30px_90px_-35px_rgba(220,53,119,0.8)] backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-[0_40px_100px_-30px_rgba(220,53,119,1)] animate-fadeInUp"
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Glass morphism overlay */}
              <div className="absolute inset-0 rounded-4xl bg-gradient-to-br from-white/20 to-transparent opacity-50" />

              {/* Glow effect */}
              <div className="absolute -inset-1 rounded-4xl bg-gradient-to-r from-[#f9d423] via-[#ff5a9d] to-[#d91f63] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-30" />

              <div className="relative z-10">
                <div className="text-6xl font-black tabular-nums text-white sm:text-7xl drop-shadow-2xl" style={{ fontFamily: 'Poppins, sans-serif' }} suppressHydrationWarning>
                  {mounted ? String(Math.max(value, 0)).padStart(2, "0") : "00"}
                </div>
                <p className="mt-3 text-sm font-black uppercase tracking-widest text-white/90 drop-shadow-md" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="relative z-10 mt-20 w-full max-w-4xl border-t-2 border-white/20 pt-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              href="/contact"
              className="text-sm font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
            >
              Свържете се с нас
            </Link>
            <Link
              href="/terms"
              className="text-sm font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
            >
              Общи условия
            </Link>
            <span className="hidden text-[#ffd7ec] sm:inline">•</span>
            <Link
              href="/privacy"
              className="text-sm font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
            >
              Политика за поверителност
            </Link>
            <span className="hidden text-[#ffd7ec] sm:inline">•</span>
            <Link
              href="/cookies"
              className="text-sm font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
            >
              Политика за бисквитки
            </Link>
            <span className="hidden text-[#ffd7ec] sm:inline">•</span>
          </div>
          <div className="h-px w-32 bg-linear-to-r from-transparent via-[#ffd7ec] to-transparent"></div>
          <p className="text-xs font-bold text-[#d91f63]/60">
            © 2025 Viply. Всички права запазени.
          </p>
          {currentUserId && (
            <p className="text-[10px] font-mono text-[#d91f63]/20 select-all">
              ID: {currentUserId}
            </p>
          )}
        </div>
      </footer>

      {/* Cookie Banner */}
      {showCookieBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t-4 border-[#ffd7ec] shadow-[0_-10px_40px_-10px_rgба(220,53,119,0.3)] p-6 animate-[slideUp_0.3s_ease-out]">
          <div className="mx-auto max-w-4xl flex flex-col gap-4">
            <div className="flex-1">
              <p className="text-sm font-bold text-[#d91f63] mb-2">
                🍪 Използваме бисквитки
              </p>
              <p className="text-xs text-[#d91f63]/80 mb-3">
                Този сайт използва технически бисквитки, необходими за правилното функциониране.{' '}
                <Link href="/cookies" className="underline hover:text-[#ff5a9d]">
                  Научете повече
                </Link>
              </p>
              <p className="text-xs text-[#d91f63]/80 mb-4">
                Искате ли да ни помогнете да подобрим услугата, като ни позволите да събираме анонимна статистика? (по избор)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleAcceptCookies(true)}
                className="flex-1 rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-xl whitespace-nowrap"
              >
                Да, помагам
              </button>
              <button
                onClick={() => handleAcceptCookies(false)}
                className="flex-1 rounded-full border-2 border-[#d91f63] bg-white px-6 py-3 text-sm font-bold text-[#d91f63] shadow-lg transition hover:scale-105 hover:shadow-xl whitespace-nowrap"
              >
                Не, благодаря
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
