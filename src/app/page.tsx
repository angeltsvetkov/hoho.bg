"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { storage, db, auth, getUserData, canUserCustomize, incrementCustomizationCount, markDefaultMessageListened, signInWithGoogle, awardReferralBonus, handleRedirectResult } from "@/lib/firebase";
import { initializeAnalyticsWithConsent, setAnalyticsConsent, trackPageView, trackAudioPlay, trackCustomization, trackShare, trackPurchaseIntent } from "@/lib/analytics";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import AnimatedSanta from "@/components/AnimatedSanta";
import dailyVideos from "@/data/daily-videos.json";

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

function HomeContent() {
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
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [dailyVideoUrl, setDailyVideoUrl] = useState<string | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Подготвяме гласа...");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showInfoSubmenu, setShowInfoSubmenu] = useState(false);
  const [showBigPlayButton, setShowBigPlayButton] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const videoId = searchParams.get('v');
    if (videoId) {
      const fetchSharedVideo = async () => {
        try {
          const docRef = doc(db, "sharedMessages", videoId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.videoUrl) {
              setGeneratedVideoUrl(data.videoUrl);
              setDailyVideoUrl(null);
              setIsVideoMuted(false);
              setIsPlaying(false);
              setShowBigPlayButton(true);
            }
            if (data.text) {
              setMessage(data.text);
              setTempMessage(data.text);
            }
          }
        } catch (error) {
          console.error("Error fetching shared video:", error);
        }
      };
      
      fetchSharedVideo();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isGenerating) return;

    const messages = [
      "Събираме елфите за ежедневния брифинг...",
      "Даваме инструкции на Дядо Коледа...",
      "Проверяваме дали шейната е паркирана правилно...",
      "Дядо Коледа загрява гласа си...",
      "Търсим най-палавото джудже за помощ...",
      "Подготвяме коледния микрофон...",
      "Джуджетата изглаждат сценария...",
      "Правим финални настройки...",
      "Джуджетата записват посланието...",
      "Добавяме щипка коледна магия...",
      "Полираме звезден прах... почти готово...",
      "Още малко търпение...",
      "Опаковаме видеото с красива панделка...",
      "Видео подаръкът лети към теб!"
    ];

    let index = 0;
    setLoadingMessage(messages[0]);

    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, [isGenerating]);

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

      // Clear local state
      setCurrentUserId(null);
      setUserProfile(null);
      setCustomizationsRemaining(null);
      setShowProfileMenu(false);

      // No reload - let the UI update naturally
    } catch (error) {
      console.error('❌ Error signing out:', error);
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
        // Check if we're coming back from a redirect BEFORE checking auth state
        const pendingRedirect = sessionStorage.getItem('pendingRedirect');
        if (pendingRedirect) {
          // Handle redirect FIRST, before waiting for auth state
          const redirectResult = await handleRedirectResult();
          if (redirectResult) {
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

        const authUser = await new Promise<User | null>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
          });
        });

        // If no pending redirect, check for redirect result after auth state settles
        if (!pendingRedirect) {
          const redirectResult = await handleRedirectResult();
          if (redirectResult) {
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

        // Set user profile if logged in with Google
        if (authUser && !authUser.isAnonymous) {
          const profileData = {
            photoURL: authUser.photoURL,
            displayName: authUser.displayName,
          };
          setUserProfile(profileData);
          setCurrentUserId(authUser.uid);

          const userData = await getUserData(authUser.uid);
          setCustomizationsRemaining(userData.customizationsAllowed - userData.customizationsUsed);
          if (userData.hasListenedToDefault) {
            setHasListened(true);
          }

          await processReferralBonus(authUser.uid);

          await processReferralBonus(authUser.uid);

        } else {
          // No user logged in
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
        setUserProfile({
          photoURL: user.photoURL,
          displayName: user.displayName,
        });
      } else {
        setCurrentUserId(null);
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);



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
      setDailyVideoUrl(null); // Ensure daily video doesn't override custom video

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
      let firebaseAudioUrl: string | null = null;
      let uniqueId = ''; // Declare here so it's accessible for video URL save

      try {
        const timestamp = Date.now();
        uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `speech/${uniqueId}.mp3`;
        const storageRef = ref(storage, fileName);

        await uploadBytes(storageRef, audioBlob);
        const firebaseUrl = await getDownloadURL(storageRef);
        firebaseAudioUrl = firebaseUrl; // Store locally for video generation

        // Save message data to Firestore
        const messageDoc = doc(db, "sharedMessages", uniqueId);
        await setDoc(messageDoc, {
          text: messageText,
          audioUrl: firebaseUrl,
          createdAt: timestamp,
        });

        // Generate shareable URL
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const shareUrl = `${baseUrl}/?v=${uniqueId}`;
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

      // Generate lip-synced video with WaveSpeedAI
      setGeneratedVideoUrl(null); // Clear any previous video

      if (firebaseAudioUrl) {
        try {
          // Use pre-uploaded Santa image (WebP format)
          const santaImageUrl = 'https://firebasestorage.googleapis.com/v0/b/hoho-bg.firebasestorage.app/o/images%2Fsanta-talking.webp?alt=media&token=d50d404c-d9e4-4c4c-b7e3-b945ae92ac2e';

          // Call WaveSpeedAI API to generate lip-synced video
          const videoResponse = await fetch('/api/wavespeed-lipsync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioUrl: firebaseAudioUrl,
              imageUrl: santaImageUrl,
            }),
          });

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            if (videoData.success && videoData.videoUrl) {

              // Download video from WaveSpeedAI and upload to Firebase Storage
              try {
                const videoDownloadResponse = await fetch(videoData.videoUrl);
                if (!videoDownloadResponse.ok) {
                  throw new Error('Failed to download video');
                }

                const videoBlob = await videoDownloadResponse.blob();

                // Upload to Firebase Storage
                const videoStorageRef = ref(storage, `videos/${uniqueId}.mp4`);
                await uploadBytes(videoStorageRef, videoBlob);
                const firebaseVideoUrl = await getDownloadURL(videoStorageRef);

                setGeneratedVideoUrl(firebaseVideoUrl);

                // Play video
                setDailyVideoUrl(null);
                setIsVideoMuted(false);
                setIsPlaying(true);

                // Save Firebase video URL to Firestore
                const messageDoc = doc(db, "sharedMessages", uniqueId);
                await setDoc(messageDoc, {
                  videoUrl: firebaseVideoUrl,
                }, { merge: true });

              } catch (videoUploadError) {
                console.error('Failed to upload video to Firebase:', videoUploadError);
                // Fallback: use WaveSpeedAI URL directly
                console.warn('Using WaveSpeedAI URL as fallback');
                setGeneratedVideoUrl(videoData.videoUrl);

                // Play video
                setDailyVideoUrl(null);
                setIsVideoMuted(false);
                setIsPlaying(true);

                try {
                  const messageDoc = doc(db, "sharedMessages", uniqueId);
                  await setDoc(messageDoc, {
                    videoUrl: videoData.videoUrl,
                  }, { merge: true });
                } catch (saveError) {
                  console.error('Failed to save video URL:', saveError);
                }
              }
            } else {
              console.warn('⚠️ Video generation failed');
            }
          } else {
            const error = await videoResponse.json();
            console.warn('⚠️ WaveSpeedAI error:', error.error);
          }
        } catch (videoError) {
          console.error('❌ Error generating video:', videoError);
        }
      } else {
        console.warn('⚠️ No Firebase audio URL available, skipping video generation');
      }

      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsGenerating(false);
    }
  };

  const handlePlayButton = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (generatedVideoUrl) {
      setIsPlaying(true);
      setIsVideoMuted(false);
      return;
    }
    
    // Try to find a daily video
    const daysLeft = timeLeft.days;
    const videoUrl = (dailyVideos as Record<string, string>)[String(daysLeft)];

    if (videoUrl) {
      setDailyVideoUrl(videoUrl);
      setIsPlaying(true);
      setIsVideoMuted(false);
      return;
    }

    await generateAndPlayNewSpeech(message);
  };

  const handleShare = async () => {
    if (!shareableUrl) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Хо Хо Хо! 🎅',
          text: 'Вижте моето коледно послание от Дядо Коледа!',
          url: shareableUrl,
        });
        trackShare('native');
      } catch {
        // User likely cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareableUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        trackShare('copy');
        alert('Линкът е копиран!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleShareFacebook = () => {
    if (shareableUrl) {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
      window.open(url, '_blank');
      trackShare('facebook');
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
      // Also close mobile menu
      if (showMobileMenu && !target.closest('.absolute.bottom-6.right-6')) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu, showMobileMenu]);

  const countdownValues = [
    { label: "Дни", value: timeLeft.days },
    { label: "Часa", value: timeLeft.hours },
    { label: "Минути", value: timeLeft.minutes },
    { label: "Секунди", value: timeLeft.seconds },
  ];

  return (
    <>
      <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-0 md:px-6 pt-0 md:pt-12 pb-6 md:pb-3 text-[#2b1830]">
        {/* Full Screen Santa Background - REMOVED */}
        {/* <div className="fixed inset-0 z-0">
        <AnimatedSanta
          isPlaying={isPlaying}
          className="h-full w-full object-cover"
        />
      </div> */}

        {/* Snowfall Effect - Only render on client to avoid hydration mismatch */}
        {mounted && (
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
        )}





        {/* Santa Video/Animation - Left side, full height */}
        <div className="relative w-full h-screen md:h-full md:fixed md:left-0 md:top-0 md:w-1/3 md:min-w-[550px] lg:w-[40%] lg:min-w-[600px] xl:w-[45%] xl:min-w-[650px] p-0 md:p-3 lg:pl-12 xl:pl-24 flex items-center justify-center pointer-events-none md:pointer-events-auto" style={{ zIndex: 50 }}>
          <div className="relative w-full h-full md:w-auto md:h-full md:min-w-[520px] overflow-hidden md:rounded-4xl md:border-12 md:border-white bg-white md:shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-full pointer-events-auto" style={{ aspectRatio: '720/1200' }}>
            <AnimatedSanta
              isPlaying={isPlaying}
              videoUrl={dailyVideoUrl || generatedVideoUrl}
              isMuted={isVideoMuted}
              onVideoEnded={() => {
                setIsPlaying(false);
                setIsVideoMuted(true);
                if (dailyVideoUrl) {
                  setDailyVideoUrl(null); // Clear daily video to revert to idle
                }
              }}
              className={`h-full w-full object-cover transition-all duration-500 ${isGenerating ? 'blur-md scale-105' : ''}`}
            />

            {/* Watermark */}
            <div className="absolute bottom-2 left-0 right-0 z-20 text-center pointer-events-none md:hidden">
              <p className="text-[10px] font-bold text-white/50 drop-shadow-md">
                © 2025 Viply.
              </p>
            </div>

            {/* Loading Overlay */}
            {isGenerating && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-white/90 shadow-2xl backdrop-blur-md mx-4 text-center">
                  <div className="relative size-16">
                    <div className="absolute inset-0 rounded-full border-4 border-[#ffd7ec]"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-[#ff5a9d] animate-spin"></div>
                  </div>
                  <p className="text-lg font-bold text-[#d91f63] animate-pulse">{loadingMessage}</p>
                </div>
              </div>
            )}

            {/* Login Button Overlay (when not logged in) */}
            {!isAuthLoading && !currentUserId && (
              <div className="hidden md:block absolute top-4 left-4 z-30">
                <button
                  onClick={async () => {
                    try {
                      const { userId, isNewUser } = await signInWithGoogle();
                      setCurrentUserId(userId);

                      // Set user profile
                      const user = auth.currentUser;
                      if (user) {
                        setUserProfile({
                          photoURL: user.photoURL,
                          displayName: user.displayName,
                        });
                      }

                      const userData = await getUserData(userId, false);
                      const remaining = userData.customizationsAllowed - userData.customizationsUsed;
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
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-110"
                >
                  <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-7">
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {/* Mobile Context Menu */}
            <div className="absolute bottom-6 right-6 z-50 md:hidden">
              {!currentUserId ? (
                <button
                  onClick={async () => {
                    try {
                      const { userId, isNewUser } = await signInWithGoogle();
                      setCurrentUserId(userId);

                      // Set user profile
                      const user = auth.currentUser;
                      if (user) {
                        setUserProfile({
                          photoURL: user.photoURL,
                          displayName: user.displayName,
                        });
                      }

                      const userData = await getUserData(userId, false);
                      const remaining = userData.customizationsAllowed - userData.customizationsUsed;
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
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-110"
                >
                  <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMobileMenu(!showMobileMenu);
                    }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-110"
                  >
                    <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    </div>
                  </button>

                  {/* Badge for remaining customizations */}
                  {customizationsRemaining !== null && (
                    <div className="absolute -top-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#d91f63] text-xs font-black text-white shadow-lg pointer-events-none">
                      {customizationsRemaining}
                    </div>
                  )}
                </div>
              )}

              {showMobileMenu && currentUserId && (
                <div className="absolute bottom-full right-0 mb-4 flex w-64 flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
                  {showInfoSubmenu ? (
                    <>
                      <div className="flex items-center gap-3 border-b border-gray-100 bg-pink-50/50 px-4 py-3">
                        <button 
                          onClick={() => setShowInfoSubmenu(false)}
                          className="flex items-center justify-center rounded-full p-1 hover:bg-pink-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-5 text-[#d91f63]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                          </svg>
                        </button>
                        <span className="text-sm font-bold text-[#2b1830]">Информация</span>
                      </div>
                      <div className="flex flex-col p-2">
                        <Link href="/contact" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100 rounded-xl">Контакт</Link>
                        <Link href="/terms" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100 rounded-xl">Условия</Link>
                        <Link href="/privacy" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100 rounded-xl">Поверителност</Link>
                        <Link href="/cookies" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100 rounded-xl">Бисквитки</Link>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* User Profile Header */}
                      {currentUserId && (
                        <div className="flex items-center gap-3 border-b border-gray-100 bg-pink-50/50 px-4 py-3">
                          {userProfile?.photoURL ? (
                            <Image
                              src={userProfile.photoURL}
                              alt={userProfile.displayName || 'User'}
                              width={40}
                              height={40}
                              className="size-10 rounded-full object-cover ring-2 ring-white"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white ring-2 ring-white">
                              <span className="text-sm font-bold">
                                {userProfile?.displayName?.[0]?.toUpperCase() || '👤'}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate text-sm font-bold text-[#2b1830]">
                              {userProfile?.displayName || 'Потребител'}
                            </span>
                            <span className="text-xs text-[#d91f63]">
                              {customizationsRemaining} персонализации
                            </span>
                          </div>
                        </div>
                      )}

                      {isCustomMessage && (
                        <button
                          onClick={() => {
                            setShowMobileMenu(false);
                            handleOpenEditor();
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100"
                        >
                          <span>✏️</span>
                          Редактирай
                        </button>
                      )}
                      
                      {shareableUrl && (
                        <>
                          <button
                            onClick={() => {
                              setShowMobileMenu(false);
                              handleShare();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100"
                          >
                            <span>🎁</span>
                            Сподели
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowMobileMenu(false);
                              navigator.clipboard.writeText(shareableUrl);
                              alert('Линкът е копиран!');
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100"
                          >
                            <span>📋</span>
                            Копирай линк
                          </button>
                        </>
                      )}

                      {!isCustomMessage && (
                        <button
                          onClick={() => {
                            setShowMobileMenu(false);
                            handleOpenEditor();
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100"
                        >
                          <span>✨</span>
                          Създай свое
                        </button>
                      )}

                      {/* Logout and Buy More */}
                      {currentUserId && (
                        <>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            onClick={() => {
                              setShowMobileMenu(false);
                              setIsPurchaseModalOpen(true);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#d91f63] hover:bg-pink-50 active:bg-pink-100"
                          >
                            <span>🎁</span>
                            Купи още
                          </button>
                          
                          <button
                            onClick={() => setShowInfoSubmenu(true)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#2b1830] hover:bg-pink-50 active:bg-pink-100"
                          >
                            <span>ℹ️</span>
                            Информация
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileMenu(false);
                              handleLogout();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 active:bg-red-100"
                          >
                            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Изход
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Auth Loading State */}
            {isAuthLoading && (
              <div className="absolute top-4 left-4 z-30">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm">
                  <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white">
                    <svg className="size-8 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Avatar Overlay */}
            {!isAuthLoading && currentUserId && (
              <div className="hidden md:block absolute top-4 left-4 z-30 profile-menu-container">
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform duration-300 hover:scale-110"
                  >
                    {userProfile?.photoURL ? (
                      <Image
                        src={userProfile.photoURL}
                        alt={userProfile.displayName || 'User'}
                        width={56}
                        height={56}
                        className="size-14 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] text-white">
                        <span className="text-2xl font-bold">
                          {userProfile?.displayName?.[0]?.toUpperCase() || '👤'}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Badge for remaining customizations */}
                  {customizationsRemaining !== null && (
                    <div className="absolute -bottom-1 -right-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#d91f63] text-xs font-black text-white shadow-lg pointer-events-none">
                      {customizationsRemaining}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {showProfileMenu && (
                    <div className="absolute left-0 top-full mt-2 w-48 overflow-hidden rounded-xl border-2 border-white bg-white shadow-xl ring-1 ring-black/5">
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setIsPurchaseModalOpen(true);
                            setShowProfileMenu(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-[#d91f63] transition hover:bg-[#fff0f8]"
                        >
                          <span className="text-lg">🎁</span>
                          Купи още
                        </button>
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
              </div>
            )}

            {/* Play Button Overlay */}
            {!isPlaying && (
              <button
                onClick={handlePlayButton}
                className="absolute top-4 right-4 z-30 flex items-center justify-center group cursor-pointer"
                aria-label="Play Santa's Message"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8 text-[#d91f63]">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            )}

            {/* Big Center Play Button for Shared Videos */}
            {showBigPlayButton && !isPlaying && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <button
                  onClick={() => {
                    setIsPlaying(true);
                    setShowBigPlayButton(false);
                  }}
                  className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgba(217,31,99,0.6)] transition-transform duration-300 hover:scale-110"
                  aria-label="Play Shared Video"
                >
                  <div className="absolute inset-0 rounded-full bg-[#d91f63] opacity-20 animate-ping"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-2 h-12 w-12 text-[#d91f63]">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}



            {/* Countdown Overlay */}
            <div className="hidden md:block absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/60 to-transparent p-4 pt-20 z-20">
              <div className="mb-3 text-center">
                <h1 className="bg-linear-to-b from-white via-[#ffcccc] to-[#ff0000] bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl" style={{ fontFamily: 'Poppins, sans-serif', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
                  ✨ До Коледа остават ✨
                </h1>
              </div>
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                {countdownValues.map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="bg-linear-to-b from-white via-[#ff0000] to-[#990000] bg-clip-text text-3xl font-black tabular-nums text-transparent drop-shadow-[0_2px_2px_rgba(255,255,255,0.3)] sm:text-5xl" style={{ fontFamily: 'Poppins, sans-serif', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }} suppressHydrationWarning>
                      {mounted ? String(Math.max(value, 0)).padStart(2, "0") : "00"}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#ffd7ec] drop-shadow-md sm:text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex relative z-10 w-full flex-1 flex-col items-center gap-8 mt-8 md:mt-0 md:w-2/3 md:max-w-[calc(100%-550px)] lg:w-[60%] lg:max-w-[calc(100%-600px)] xl:w-[55%] xl:max-w-[calc(100%-650px)] md:ml-auto">
          {/* Santa Frame with Overlay Content */}
          <div className="flex w-full flex-1 flex-col items-center justify-end pb-48 md:justify-center md:pb-0">

            {/* Message Bubble Container - Overlays on top of Santa */}
            <div className="hidden md:block relative z-20 w-full max-w-2xl px-6">
              <div className="relative w-full rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8]/90 to-[#ffe8f5]/90 px-6 py-6 text-center shadow-[0_30px_90px_-30px_rgba(178,24,77,0.4)] backdrop-blur-sm">
                {isCustomMessage && !isGenerating && (
                  <>
                    <button
                      onClick={handleOpenEditor}
                      className="hidden md:flex absolute -left-4 -top-4 size-12 items-center justify-center rounded-full bg-white text-2xl shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] transition hover:scale-110 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]"
                      aria-label="Редактирай послание"
                    >
                      ✏️
                    </button>
                  </>
                )}
                <p
                  onClick={!isCustomMessage ? handleOpenEditor : undefined}
                  className={`text-xl font-black leading-relaxed text-[#d91f63] sm:text-2xl ${!isCustomMessage ? 'cursor-pointer transition hover:scale-105' : ''}`}
                >
                  {message}
                </p>
              </div>

              {/* Action Buttons (Inside Video Frame) */}
              {!isCustomMessage && (
                <button
                  onClick={hasListened ? handleOpenEditor : handlePlayButton}
                  className="group relative w-full max-w-sm flex items-center justify-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-4 text-base font-black text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)] transition-all duration-300 hover:scale-105 hover:shadow-[0_30px_80px_-10px_rgba(220,53,119,1)] animate-pulse-scale mt-8 mx-auto"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                  aria-label={hasListened ? "Персонализирай посланието" : "Чуй посланието на Дядо Коледа"}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-linear-to-r from-transparent via-white/30 to-transparent" />

                  <span className="relative z-10 text-xl">{hasListened ? '✏️' : '🔊'}</span>
                  <span className="relative z-10">{hasListened ? 'Персонализирай посланието' : 'Чуй посланието на Дядо Коледа'}</span>
                </button>
              )}
              {isCustomMessage && lastGeneratedAudioUrl && !isGenerating && (
                <div className="hidden md:flex flex-col items-center gap-3 mt-8">
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
          </div> {/* Close message bubble container */}

          {/* Footer */}
          <footer className="hidden md:block mt-auto w-full border-t-2 border-white/20 pt-4 pb-2 relative z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link
                  href="/contact"
                  className="text-xs font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
                >
                  Контакт
                </Link>
                <span className="text-[#ffd7ec]">•</span>
                <Link
                  href="/terms"
                  className="text-xs font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
                >
                  Условия
                </Link>
                <span className="text-[#ffd7ec]">•</span>
                <Link
                  href="/privacy"
                  className="text-xs font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
                >
                  Поверителност
                </Link>
                <span className="text-[#ffd7ec]">•</span>
                <Link
                  href="/cookies"
                  className="text-xs font-bold text-[#d91f63] transition hover:scale-105 hover:text-[#ff5a9d]"
                >
                  Бисквитки
                </Link>
              </div>
              <p className="text-[10px] font-bold text-[#d91f63]/60">
                © 2025 Viply.
              </p>
            </div>
          </footer>
        </div>
      </main>

      {/* Modals */}
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
              rows={6}
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
                Персонализирай
              </button>
            </div>
          </div >
        </div >
      )
      }

      {/* Referral Modal */}
      {
        isReferralModalOpen && (
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
        )
      }

      {
        isPurchaseModalOpen && (
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
                        const { userId, isNewUser } = await signInWithGoogle();
                        setCurrentUserId(userId);

                        // Set user profile
                        const user = auth.currentUser;
                        if (user) {
                          setUserProfile({
                            photoURL: user.photoURL,
                            displayName: user.displayName,
                          });
                        }

                        const userData = await getUserData(userId, false);
                        const remaining = userData.customizationsAllowed - userData.customizationsUsed;
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
        )
      }



      {/* Cookie Banner */}
      {
        showCookieBanner && (
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
        )
      }
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0f172a] text-white">Зареждане...</div>}>
      <HomeContent />
    </Suspense>
  );
}
