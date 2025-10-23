import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export const useCommunityPostLike = () => {
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);

  const toggleLike = async (postId: string) => {
    if (!user) {
      toast.error("Please sign in to like posts");
      return;
    }

    setIsLiking(true);
    try {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from("community_post_likes")
        .select("*")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .single();

      if (existingLike) {
        // Unlike
        const { error } = await supabase
          .from("community_post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from("community_post_likes")
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    } finally {
      setIsLiking(false);
    }
  };

  return { toggleLike, isLiking };
};
