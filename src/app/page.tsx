"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { storage, db } from "@/lib/firebase";
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareableUrl);
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
    
    const url = encodeURIComponent(shareableUrl);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(facebookUrl, '_blank', 'width=600,height=600');
  };

  const playTextToSpeech = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    try {
      let audioUrl: string;
      
      // If message is not customized, play the predefined MP3
      if (!isCustomMessage && initialSpeechFile) {
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
    setIsCustomMessage(true); // Mark as custom message
    
    setIsGenerating(true);
    try {
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

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8">
        <div className="relative">
          <div className="mb-6 w-80 drop-shadow-[0_30px_80px_rgba(220,53,119,0.25)] sm:w-96">
            <Image
              src="/santa.png"
              alt="Весело лице на Дядо Коледа"
              width={512}
              height={512}
              priority
              className="animate-wiggle"
            />
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] px-8 py-6 text-center shadow-[0_30px_90px_-30px_rgba(178,24,77,0.4)]">
            <button
              onClick={() => {
                setTempMessage(message);
                setIsModalOpen(true);
              }}
              className="absolute -left-4 -top-4 flex size-12 items-center justify-center rounded-full bg-white text-2xl shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] transition hover:scale-110 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]"
              aria-label="Редактирай послание"
            >
              ✏️
            </button>
            <button
              onClick={showPlayPrompt ? handlePlayPrompt : playTextToSpeech}
              disabled={isPlaying}
              className={`absolute -right-4 -top-4 flex size-12 items-center justify-center rounded-full text-2xl transition hover:scale-110 disabled:opacity-50 disabled:hover:scale-100 ${
                showPlayPrompt 
                  ? 'animate-pulse-scale bg-[#ff5a9d] text-white shadow-[0_20px_60px_-15px_rgba(220,53,119,0.8)]' 
                  : 'bg-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.5)] hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.6)]'
              }`}
              aria-label="Чуй посланието"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <p className="text-2xl font-black leading-relaxed text-[#d91f63]">
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
          {isCustomMessage && lastGeneratedAudioUrl && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {shareableUrl && (
                <div className="w-full max-w-md rounded-3xl border-4 border-white bg-white px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareableUrl}
                      readOnly
                      className="flex-1 truncate bg-transparent text-sm font-bold text-[#d91f63] outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareableUrl);
                        alert('Линкът е копиран! 🎉');
                      }}
                      className="shrink-0 rounded-full bg-[#ff5a9d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ff85b8]"
                    >
                      📋 Копирай
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-3">
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
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>
              </div>
            </div>
          )}
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

      <div className="relative z-10 w-full max-w-4xl">
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
    </main>
  );
}
