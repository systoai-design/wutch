import { useEffect } from 'react';
import { getOptimalPreloadStrategy } from '@/utils/performanceOptimization';

interface UseIntelligentPreloadOptions {
  videoRefs: React.RefObject<HTMLVideoElement>[];
  activeIndex: number;
}

/**
 * Intelligently preloads videos based on proximity to active video
 * Active video: full preload
 * Next 2 videos: auto preload (ready to play)
 * Rest: metadata only
 */
export function useIntelligentPreload({ 
  videoRefs, 
  activeIndex 
}: UseIntelligentPreloadOptions) {
  useEffect(() => {
    const optimalStrategy = getOptimalPreloadStrategy();
    
    videoRefs.forEach((ref, index) => {
      const video = ref.current;
      if (!video) return;

      const distance = Math.abs(index - activeIndex);
      
      if (distance === 0) {
        // Active video: full preload
        video.preload = 'auto';
      } else if (distance <= 2) {
        // Next 2 videos: preload based on connection
        video.preload = optimalStrategy;
      } else {
        // Far away: metadata only
        video.preload = 'metadata';
      }
    });
  }, [videoRefs, activeIndex]);
}
