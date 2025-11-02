import { useEffect, useRef } from 'react';

interface UseAutoPlayShortOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  shortId: string;
  isActive: boolean;
  isMuted: boolean;
  onBecomeActive?: () => void;
}

export function useAutoPlayShort({ 
  videoRef, 
  shortId, 
  isActive,
  isMuted,
  onBecomeActive 
}: UseAutoPlayShortOptions) {
  const hasPlayedRef = useRef(false);

  // Direct playback control based on isActive prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Immediately play when active
      if (onBecomeActive) {
        onBecomeActive();
      }
      
      video.muted = isMuted;
      // Try to play - don't force mute if it fails
      video.play().catch((error) => {
        console.log('Autoplay prevented:', error);
      });
      
      hasPlayedRef.current = true;
    } else {
      // Immediately pause, reset, and mute inactive videos
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      hasPlayedRef.current = false;
    }

    return () => {
      // Cleanup: ensure video is paused and muted
      if (video) {
        video.pause();
        video.muted = true;
      }
    };
  }, [isActive, isMuted, onBecomeActive]);

  // Handle video loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (isActive) {
        video.currentTime = 0;
        video.play().catch(e => console.log('Loop play failed:', e));
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [isActive]);

  // Intelligent preload management: active + next 2 videos get auto preload
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Active video: full preload
      video.preload = 'auto';
    } else {
      // Inactive: metadata only (will be upgraded when nearby)
      video.preload = 'metadata';
    }
  }, [isActive, videoRef]);
}
