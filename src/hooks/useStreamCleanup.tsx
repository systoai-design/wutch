import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to periodically check and cleanup ended streams
 * Runs on mount and every 30 minutes
 */
export const useStreamCleanup = () => {
  useEffect(() => {
    const checkStaleStreams = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('cleanup-ended-streams');
        
        if (error) {
          console.error('Stream cleanup error:', error);
          return;
        }
        
        if (data?.cleaned > 0) {
          console.log(`Cleaned up ${data.cleaned} stale streams`);
        }
      } catch (error) {
        console.error('Stream cleanup error:', error);
      }
    };

    // Run on mount
    checkStaleStreams();
    
    // Run every 30 minutes
    const interval = setInterval(checkStaleStreams, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
};
