import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function useShortVideoLike(shortVideoId: string) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkIfLiked();
    }
  }, [user, shortVideoId]);

  const checkIfLiked = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("short_video_likes")
        .select("*")
        .eq("user_id", user.id)
        .eq("short_video_id", shortVideoId)
        .maybeSingle();

      if (error) throw error;
      setIsLiked(!!data);
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  };

  const toggleLike = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like videos",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    const previousLikeState = isLiked;
    const previousCount = likeCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(prev => prev + (isLiked ? -1 : 1));

    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from("short_video_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("short_video_id", shortVideoId);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from("short_video_likes")
          .insert({
            user_id: user.id,
            short_video_id: shortVideoId,
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic update
      setIsLiked(previousLikeState);
      setLikeCount(previousCount);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLiked,
    likeCount,
    toggleLike,
    setLikeCount, // Allow external updates
  };
}
