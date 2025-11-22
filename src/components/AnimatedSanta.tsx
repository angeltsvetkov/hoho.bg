"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface AnimatedSantaProps {
    isPlaying: boolean;
    className?: string;
    videoUrl?: string | null; // NEW: WaveSpeedAI generated video
    onVideoEnded?: () => void;
    isMuted?: boolean;
}

export default function AnimatedSanta({ isPlaying, className = "", videoUrl = null, onVideoEnded, isMuted = true }: AnimatedSantaProps) {
    const idleVideoRef = useRef<HTMLVideoElement>(null);
    const lipsyncVideoRef = useRef<HTMLVideoElement>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);

    // Reset video ready state when URL changes
    useEffect(() => {
        setIsVideoReady(false);
    }, [videoUrl]);

    useEffect(() => {
        const idleVideo = idleVideoRef.current;

        if (idleVideo) {
            // Only pause idle video when the talking video is actually ready to show
            const shouldShowTalking = isPlaying && (videoUrl ? isVideoReady : true);
            
            if (shouldShowTalking) {
                // Delay pausing the idle video to allow for a smooth crossfade
                const timer = setTimeout(() => {
                    idleVideo.pause();
                }, 500);
                return () => clearTimeout(timer);
            } else {
                idleVideo.play().catch(e => console.error("Idle play failed", e));
            }
        }
    }, [isPlaying, isVideoReady, videoUrl]);

    // Handle lip-synced video playback
    useEffect(() => {
        const lipsyncVideo = lipsyncVideoRef.current;

        if (lipsyncVideo) {
            if (videoUrl && isPlaying) {
                lipsyncVideo.src = videoUrl;
                // Reset ready state if we are starting a new playback
                if (lipsyncVideo.readyState < 3) { // HAVE_FUTURE_DATA
                    setIsVideoReady(false);
                } else {
                    setIsVideoReady(true);
                }
                
                lipsyncVideo.play().catch(e => console.error("Lipsync video play failed", e));
            } else {
                // Delay pausing the talking video to allow for a smooth crossfade
                const timer = setTimeout(() => {
                    lipsyncVideo.pause();
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [videoUrl, isPlaying]);

    // Determine visibility
    // Show talking video only if playing AND (video is ready OR it's a static image fallback)
    const showTalking = isPlaying && (videoUrl ? isVideoReady : true);

    return (
        <div className={`relative h-full w-full overflow-hidden bg-slate-900 ${className}`}>
            {/* Idle Video */}
            <video
                ref={idleVideoRef}
                src="/santa-idle.mp4"
                loop
                muted
                playsInline
                autoPlay
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 scale-110"
                style={{ opacity: showTalking ? 0 : 1, zIndex: 5 }}
            />

            {/* Talking Animation */}
            <div
                className="absolute inset-0 h-full w-full transition-opacity duration-500"
                style={{ opacity: showTalking ? 1 : 0, zIndex: 6 }}
            >
                {videoUrl ? (
                    // WaveSpeedAI generated lip-synced video
                    <video
                        ref={lipsyncVideoRef}
                        className="h-full w-full object-cover"
                        playsInline
                        muted={isMuted}
                        onLoadedData={() => setIsVideoReady(true)}
                        onWaiting={() => setIsVideoReady(false)}
                        onPlaying={() => setIsVideoReady(true)}
                        onError={(e) => {
                            console.error("Video playback error:", e);
                            if (onVideoEnded) onVideoEnded();
                        }}
                        onEnded={() => {
                            if (onVideoEnded) {
                                onVideoEnded();
                            } else {
                                // Loop the video if audio is still playing
                                if (lipsyncVideoRef.current && isPlaying) {
                                    lipsyncVideoRef.current.currentTime = 0;
                                    lipsyncVideoRef.current.play();
                                }
                            }
                        }}
                    />
                ) : (
                    // Fallback: Static image while video is generating or on error
                    <Image
                        src="/santa-talking.webp"
                        alt="Santa Talking"
                        fill
                        className="object-cover"
                        priority
                    />
                )}
            </div>
        </div>
    );
}
