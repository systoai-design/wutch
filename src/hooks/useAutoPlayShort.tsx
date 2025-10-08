import { useEffect, useRef } from 'react';

interface UseAutoPlayShortOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  shortId: string;
  isActive: boolean;
  onBecomeActive?: () => void;
}

export function useAutoPlayShort({ 
  videoRef, 
  shortId, 
  isActive,
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
          
          // Auto-play if not already playing
          video.play().catch((error) => {
            // Autoplay was prevented - ensure muted attribute is set
            console.log('Autoplay prevented, ensuring muted:', error);
            if (!video.muted) {
              video.muted = true;
              video.play().catch(e => console.log('Autoplay failed even with mute:', e));
            }
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
  }, [videoRef, shortId, onBecomeActive]);

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
