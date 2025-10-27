import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useCommunityPostQuery = (postId: string) => {
  const { user } = useAuth();

  const { data: post, isLoading } = useQuery({
    queryKey: ["community-post", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select(`
          *,
          user:profiles!community_posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          ),
          wallet:profile_wallets!community_posts_user_id_fkey (
            wallet_address
          )
        `)
        .eq("id", postId)
        .single();
      
      if (data) {
        data.user.wallet_address = data.wallet?.[0]?.wallet_address;
      }

      if (error) throw error;

      // Check if user has liked this post
      if (user) {
        const { data: like } = await supabase
          .from("community_post_likes")
          .select("*")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .single();

        return { ...data, isLiked: !!like };
      }

      return { ...data, isLiked: false };
    },
    enabled: !!postId,
  });

  return { post, isLoading };
};
