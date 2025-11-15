"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type SharedMessage = {
  text: string;
  audioUrl: string;
  createdAt: number;
};

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const [message, setMessage] = useState<SharedMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const loadSharedMessage = async () => {
      if (!params.id) return;

      try {
        const docRef = doc(db, "sharedMessages", params.id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setMessage(docSnap.data() as SharedMessage);
        } else {
          console.error("Message not found");
        }
      } catch (error) {
        console.error("Error loading message:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSharedMessage();
  }, [params.id]);

  const playAudio = async () => {
    if (!message?.audioUrl || isPlaying) return;

    setIsPlaying(true);
    try {
      const audio = new Audio(message.audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
      };
      
      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
    }
  };

  if (loading) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#ffeef7] via-[#fff9f2] to-[#f0f8ff] px-6 py-12 text-[#2b1830]">
        <div className="text-center">
          <div className="mb-4 inline-block size-12 animate-spin rounded-full border-4 border-[#ffd7ec] border-t-[#ff5a9d]"></div>
          <p className="text-xl font-bold text-[#d91f63]">Зареждаме посланието...</p>
        </div>
      </main>
    );
  }

  if (!message) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#ffeef7] via-[#fff9f2] to-[#f0f8ff] px-6 py-12 text-[#2b1830]">
        <div className="text-center">
          <p className="mb-4 text-2xl font-bold text-[#d91f63]">Посланието не е намерено 😢</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105"
          >
            Към началото
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-[#ffeef7] via-[#fff9f2] to-[#f0f8ff] px-6 py-12 text-[#2b1830]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,220,240,0.4),rgba(255,255,255,0))] opacity-70"
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
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
            <p className="text-2xl font-black leading-relaxed text-[#d91f63]">
              {message.text}
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <button
              onClick={playAudio}
              disabled={isPlaying}
              className="inline-flex items-center gap-2 rounded-full border-4 border-white bg-linear-to-br from-[#ff85b8] to-[#ff5a9d] px-8 py-4 text-lg font-black uppercase tracking-wider text-white shadow-[0_20px_60px_-25px_rgba(220,53,119,0.6)] transition hover:scale-105 hover:shadow-[0_25px_70px_-20px_rgba(220,53,119,0.7)] disabled:opacity-70"
              aria-label="Чуй посланието"
            >
              {isPlaying ? "⏸️ Спри" : "🔊 Чуй посланието на Дядо Коледа"}
            </button>
            <button
              onClick={() => router.push("/")}
              className="text-base font-bold text-[#d91f63] underline transition hover:text-[#ff5a9d]"
            >
              🎄 Създай свое послание
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
