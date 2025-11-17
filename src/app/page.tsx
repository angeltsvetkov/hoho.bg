"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { storage, db, auth, ensureAnonymousAuth, getUserData, canUserCustomize, incrementCustomizationCount, markDefaultMessageListened, isAnonymousUser, signInWithGoogle } from "@/lib/firebase";
import { getRedirectResult } from "firebase/auth";
import { initializeAnalyticsWithConsent, setAnalyticsConsent, trackPageView, trackAudioPlay, trackCustomization, trackShare, trackPurchaseIntent } from "@/lib/analytics";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";

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
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [userProfile, setUserProfile] = useState<{ photoURL: string | null; displayName: string | null } | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
      // Reload the page to re-initialize with anonymous auth
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

  const handleOpenEditor = () => {
    if (customizationsRemaining === 0) {
      setIsPurchaseModalOpen(true);
    } else {
      setTempMessage(message);
      setIsModalOpen(true);
    }
  };

  // Sign in anonymously on page load and load user data
  useEffect(() => {
    if (!mounted) return;

    const initAuth = async () => {
      try {
        // Check for redirect result first (for Arc browser and mobile)
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          console.log('✅ Redirect sign-in successful:', redirectResult.user.uid);
          // Update user data after redirect
          const userData = await getUserData(redirectResult.user.uid);
          setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);
          
          // Check if we were expecting a sign-in bonus (set before redirect)
          const expectingBonus = localStorage.getItem('expectingSignInBonus');
          if (expectingBonus === 'true') {
            localStorage.removeItem('expectingSignInBonus');
            // Check if user actually received customizations (is new or got bonus)
            const isNewUser = userData.customizationsUsed === 0 && userData.customizationsAllowed >= 3;
            if (isNewUser) {
              alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
            }
          }
        }
        
        // Wait for auth state to be restored (e.g., after page refresh)
        let authUser: any = null;
        await new Promise<void>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            authUser = user;
            unsubscribe();
            resolve();
          });
        });
        
        console.log('🔐 Auth state restored:', { 
          uid: authUser?.uid, 
          isAnonymous: authUser?.isAnonymous,
          displayName: authUser?.displayName,
          photoURL: authUser?.photoURL 
        });
        
        // Set user profile if logged in with Google
        if (authUser && !authUser.isAnonymous) {
          const profileData = {
            photoURL: authUser.photoURL,
            displayName: authUser.displayName,
          };
          console.log('👤 Setting user profile:', profileData);
          setUserProfile(profileData);
          setIsAnonymous(false);
          setCurrentUserId(authUser.uid);
          console.log('✅ User profile set for Google user, isAnonymous=false');
          
          const userData = await getUserData(authUser.uid);
          setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);
          if (userData.hasListenedToDefault) {
            setHasListened(true);
          }
        } else {
          // Anonymous user
          setIsAnonymous(true);
          const userId = await ensureAnonymousAuth();
          console.log('🔑 Auth initialized with user ID:', userId);
          setCurrentUserId(userId);
          
          const userData = await getUserData(userId);
          setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);
          if (userData.hasListenedToDefault) {
            setHasListened(true);
          }
        }
      } catch (error) {
        console.error('Error signing in anonymously:', error);
      }
    };

    initAuth();
  }, [mounted]);

  // Listen to auth state changes to keep isAnonymous in sync
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !user.isAnonymous) {
        console.log('🔄 Auth state changed: Google user detected', {
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        setIsAnonymous(false);
        setUserProfile({
          photoURL: user.photoURL,
          displayName: user.displayName,
        });
      } else if (user?.isAnonymous) {
        console.log('🔄 Auth state changed: Anonymous user detected');
        setIsAnonymous(true);
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

        // Mark as listened in Firestore
        const userId = await ensureAnonymousAuth();
        await markDefaultMessageListened(userId);
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
        const userId = await ensureAnonymousAuth();
        await markDefaultMessageListened(userId);
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
    if (!isCustomMessage) {
      try {
        const userId = await ensureAnonymousAuth();
        await markDefaultMessageListened(userId);
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
      // Ensure anonymous authentication and check limits
      const userId = await ensureAnonymousAuth();

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

  const countdownValues = [
    { label: "Дни", value: timeLeft.days },
    { label: "Часa", value: timeLeft.hours },
    { label: "Минути", value: timeLeft.minutes },
    { label: "Секунди", value: timeLeft.seconds },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-linear-to-br from-[#ffeef7] via-[#fff9f2] to-[#f0f8ff] px-6 py-12 text-[#2b1830]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,220,240,0.4),rgba(255,255,255,0))] opacity-70"
      />

      {/* Combined header badge - user profile + customizations */}
      {!isAnonymous && userProfile && customizationsRemaining !== null && (
        <div className="profile-menu-container fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-full border-2 border-white bg-white p-1 shadow-lg sm:gap-3 sm:p-2">
              {/* User profile section */}
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 transition hover:opacity-80"
              >
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'User'}
                    className="size-8 rounded-full sm:size-10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white sm:size-10">
                    <span className="text-lg font-bold sm:text-xl">
                      {userProfile.displayName?.[0]?.toUpperCase() || '👤'}
                    </span>
                  </div>
                )}
                <span className="hidden text-sm font-bold text-[#d91f63] sm:inline">
                  {userProfile.displayName}
                </span>
              </button>

              {/* Divider */}
              <div className="h-8 w-px bg-[#ffd7ec] sm:h-10"></div>

              {/* Customizations counter section */}
              <button
                onClick={() => setIsPurchaseModalOpen(true)}
                className="flex items-center gap-2 pr-1 transition hover:opacity-80 sm:pr-2"
              >
                {customizationsRemaining === 0 ? (
                  <>
                    <span className="text-xs font-bold text-[#d91f63] sm:text-sm">💳 Купи персонализации</span>
                  </>
                ) : (
                  <>
                    <span className="hidden text-sm font-bold text-[#d91f63] sm:inline">🎁 Оставащи:</span>
                    <span className="text-xs font-bold text-[#d91f63] sm:hidden">🎁</span>
                    <span className="flex size-7 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-base font-black text-white sm:size-8 sm:text-lg">
                      {customizationsRemaining}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Dropdown menu */}
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border-2 border-white bg-white shadow-xl">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#d91f63] transition hover:bg-[#fff0f8]"
                >
                  🚪 Изход
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No personalizations - show appropriate button based on login state */}
      {customizationsRemaining !== null && customizationsRemaining === 0 && (
        <button
          onClick={async () => {
            if (isAnonymous) {
              // For anonymous users, trigger sign-in directly
              try {
                console.log('🔄 Starting Google sign-in process...');
                // Use redirect on mobile devices for better compatibility
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const { userId, isNewUser } = await signInWithGoogle(isMobile);
                console.log('✅ Sign-in complete, user ID:', userId);
                setCurrentUserId(userId);
                setIsAnonymous(false);
                
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
              } catch (error: any) {
                if (error.message === 'POPUP_CANCELLED') {
                  console.log('ℹ️ Sign-in cancelled by user');
                  return;
                }
                console.error('❌ Login failed:', error);
                alert(error.message || 'Неуспешен вход. Моля, опитайте отново.');
              }
            } else {
              // For logged-in users, show purchase modal
              setIsPurchaseModalOpen(true);
            }
          }}
          className="fixed right-4 top-4 z-50 transition hover:scale-105 sm:right-6 sm:top-6"
        >
        </button>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-8">
          {/* Santa Image */}
          <div className="w-64 shrink-0 drop-shadow-[0_30px_80px_rgba(220,53,119,0.25)] sm:w-80 lg:w-96">
            <Image
              src="/santa.png"
              alt="Весело лице на Дядо Коледа"
              width={512}
              height={512}
              priority
              className="animate-wiggle"
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
                className="w-full max-w-sm flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-4 py-2 text-sm font-bold text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)] transition hover:scale-105 hover:shadow-[0_25px_70px_-10px_rgba(220,53,119,0.9)] animate-pulse-scale"
                aria-label={hasListened ? "Персонализирай посланието" : "Чуй посланието на Дядо Коледа"}
              >
                <span className="text-base">{hasListened ? '✏️' : '🔊'}</span>
                <span>{hasListened ? 'Персонализирай посланието' : 'Чуй посланието на Дядо Коледа'}</span>
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
                      className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-linear-to-br from-[#ffd7ec] to-[#ffb3d9] px-6 py-3 text-base font-black uppercase tracking-wider text-[#d91f63] shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)]"
                    >
                      {isCopied ? '✅ Копирано!' : '📋 Копирай линк'}
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-6 py-3 text-base font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)] md:hidden"
                  >
                    🎁 Сподели
                  </button>
                  <button
                    onClick={handleShareFacebook}
                    className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-[#1877f2] px-6 py-3 text-base font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(24,119,242,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(24,119,242,0.7)]"
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
                className="flex-1 rounded-3xl border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-6 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)] disabled:opacity-50"
              >
                Запази
              </button>
            </div>
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
            <p className="mb-8 text-center text-lg font-bold text-[#d91f63]/80">
              Купи персонализации, за да създаваш магични коледни послания.
            </p>

            <div className="mb-6 space-y-4">
              {isAnonymous && (
                <button
                  onClick={async () => {
                    try {
                      setIsPurchaseModalOpen(false);
                      console.log('🔄 Starting Google sign-in process...');
                      // Use redirect on mobile devices for better compatibility
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                      const { userId, isNewUser } = await signInWithGoogle(isMobile);
                      console.log('✅ Sign-in complete, user ID:', userId);
                      setCurrentUserId(userId);
                      setIsAnonymous(false);
                      
                      // Set user profile
                      const user = auth.currentUser;
                      if (user) {
                        setUserProfile({
                          photoURL: user.photoURL,
                          displayName: user.displayName,
                        });
                      }
                      
                      console.log('📊 Fetching user data...');
                      const userData = await getUserData(userId, false); // Don't create if missing - signInWithGoogle already created it
                      console.log('📦 User data:', userData);
                      const remaining = userData.customizationsAllowed - userData.customizationsUsed;
                      console.log('🎁 Customizations remaining:', remaining);
                      setCustomizationsRemaining(remaining);
                      
                      // Only show success message if user is new (received customizations)
                      if (isNewUser) {
                        alert('🎉 Добре дошли! Получихте 3 безплатни персонализации!');
                      }
                    } catch (error: any) {
                      // Don't show error if user just cancelled the popup
                      if (error.message === 'POPUP_CANCELLED') {
                        console.log('ℹ️ Sign-in cancelled by user');
                        return;
                      }
                      console.error('❌ Login failed:', error);
                      alert(error.message || 'Неуспешен вход. Моля, опитайте отново.');
                    }
                  }}
                  className="relative block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#00ff00] to-[#00cc00] px-6 py-6 text-center shadow-[0_25px_80px_-20px_rgba(0,255,0,0.8)] transition hover:scale-105 hover:shadow-[0_30px_90px_-15px_rgba(0,255,0,0.9)]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[#ffff00] px-4 py-1 text-sm font-black text-[#00cc00] shadow-lg animate-pulse-scale">
                      БЕЗПЛАТНО! 🎉
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    Влез и вземи 3 персонализации
                  </div>
                  <div className="mt-2 text-xl font-bold text-white/90">🎁 Подарък при регистрация</div>
                </button>
              )}

              <button
                onClick={() => handlePurchase(10, 3)}
                disabled={isProcessingPurchase}
                className="relative block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-6 text-center shadow-[0_25px_80px_-20px_rgba(220,53,119,0.8)] transition hover:scale-105 hover:shadow-[0_30px_90px_-15px_rgba(220,53,119,0.9)] disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#00ff00] px-4 py-1 text-sm font-black text-[#d91f63] shadow-lg animate-pulse-scale">
                    Най-изгодно! 🎁
                  </span>
                </div>
                <div className="text-3xl font-black text-white">
                  {isProcessingPurchase ? 'Зареждане...' : '10 Персонализации'}
                </div>
                <div className="mt-2 text-xl font-bold text-white/90">3 лв</div>
                <div className="mt-1 text-sm font-bold text-white/70">Само 0.30 лв на персонализация</div>
              </button>

              <button
                onClick={() => handlePurchase(3, 2)}
                disabled={isProcessingPurchase}
                className="block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ff85b8] to-[#ff5a9d] px-6 py-4 text-center shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)] disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="text-2xl font-black text-white">
                  {isProcessingPurchase ? 'Зареждане...' : '3 Персонализации'}
                </div>
                <div className="mt-1 text-lg font-bold text-white/90">2 лв</div>
              </button>

              <button
                onClick={() => handlePurchase(1, 1)}
                disabled={isProcessingPurchase}
                className="block w-full rounded-3xl border-4 border-white bg-linear-to-r from-[#ffb3d9] to-[#ff85b8] px-6 py-4 text-center shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)] disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="text-2xl font-black text-white">
                  {isProcessingPurchase ? 'Зареждане...' : '1 Персонализация'}
                </div>
                <div className="mt-1 text-lg font-bold text-white/90">1 лв</div>
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
        <div className="mb-6 text-center">
          <h1 className="text-5xl font-black tracking-tight text-[#d91f63] sm:text-6xl md:text-7xl">
            До Коледа остават
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {countdownValues.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-4xl border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] p-8 text-center shadow-[0_30px_90px_-35px_rgba(220,53,119,0.6)]"
            >
              <div className="text-6xl font-black tabular-nums text-white sm:text-7xl" suppressHydrationWarning>
                {mounted ? String(Math.max(value, 0)).padStart(2, "0") : "00"}
              </div>
              <p className="mt-3 text-sm font-black uppercase tracking-widest text-white/90">
                {label}
              </p>
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
            © 2025 BrainEXT. Всички права запазени.
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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t-4 border-[#ffd7ec] shadow-[0_-10px_40px_-10px_rgba(220,53,119,0.3)] p-6 animate-[slideUp_0.3s_ease-out]">
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
