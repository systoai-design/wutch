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
        const { error: viewError } = await supabase.rpc("increment_short_video_views", {
          video_id: videoId,
        });

        if (viewError) throw viewError;

        // Get video owner to credit earnings
        const { data: videoData, error: videoFetchError } = await supabase
          .from('short_videos')
          .select('user_id')
          .eq('id', videoId)
          .single();

        if (!videoFetchError && videoData) {
          // Credit earnings to video owner (non-blocking)
          supabase.rpc('credit_view_earnings', {
            p_user_id: videoData.user_id,
            p_content_type: 'shortvideo',
            p_content_id: videoId,
            p_view_count: 1
          }).then(({ error: earningsError }) => {
            if (earningsError) console.error('Error crediting earnings:', earningsError);
          });
        }

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
