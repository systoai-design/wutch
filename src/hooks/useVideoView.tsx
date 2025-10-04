import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useVideoView(videoId: string, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !videoId) return;

    const trackView = async () => {
      const viewedKey = `viewed_short_${videoId}`;
      
      // Check if already viewed in this session
      if (sessionStorage.getItem(viewedKey)) {
        return;
      }

      try {
        // Increment view count
        const { error } = await supabase.rpc("increment_short_video_views", {
          video_id: videoId,
        });

        if (error) throw error;

        // Mark as viewed in session
        sessionStorage.setItem(viewedKey, "true");
      } catch (error) {
        console.error("Error tracking view:", error);
      }
    };

    // Track view after a short delay to ensure user actually views the video
    const timer = setTimeout(trackView, 1000);

    return () => clearTimeout(timer);
  }, [videoId, isActive]);
}
