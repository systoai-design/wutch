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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          // Video is 50%+ visible
          if (onBecomeActive) {
            onBecomeActive();
          }
          
          // Auto-play with smart audio handling
          video.muted = isMuted;
          video.play().catch((error) => {
            // Browser blocked autoplay - force mute and retry
            console.log('Autoplay prevented, trying with mute:', error);
            video.muted = true;
            video.play().then(() => {
              // Once playing, respect user's mute preference
              setTimeout(() => {
                if (!isMuted) {
                  video.muted = false;
                  console.log('Auto-unmuted video after autoplay recovery');
                }
              }, 150);
            }).catch(e => console.log('Autoplay failed even with mute:', e));
          });
          
          hasPlayedRef.current = true;
        } else {
          // Video left viewport - pause and reset
          video.pause();
          video.currentTime = 0;
          hasPlayedRef.current = false;
        }
      },
      {
        threshold: 0.5, // Trigger when 50% visible
        rootMargin: '0px'
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [videoRef, shortId, isMuted, onBecomeActive]);

  // Preload management
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.preload = 'auto';
    } else {
      video.preload = 'metadata';
    }
  }, [isActive, videoRef]);
}
