"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
  const [targetDate, setTargetDate] = useState(() => getNextChristmas(new Date()));
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(getNextChristmas(new Date())),
  );
  const message = "Хо хо хо! Коледа е почти тук!";
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
          <div className="mx-auto w-full max-w-md rounded-4xl border-4 border-white bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] px-8 py-6 text-center shadow-[0_30px_90px_-30px_rgba(178,24,77,0.4)]">
            <p className="text-2xl font-black leading-relaxed text-[#d91f63]">
              {message}
            </p>
          </div>
        </div>
      </div>

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
              <div className="text-6xl font-black tabular-nums text-white sm:text-7xl">
                {String(Math.max(value, 0)).padStart(2, "0")}
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
