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
            avatar_url,
            service_rating_avg,
            service_rating_count,
            service_orders_completed,
            service_completion_rate
          )
        `)
        .eq("id", postId)
        .single();
      
      if (error) throw error;

      // Fetch wallet address separately
      const { data: walletData, error: walletError } = await supabase
        .from("profile_wallets")
        .select("wallet_address")
        .eq("user_id", data?.user?.id)
        .single();
      
      if (data) {
        // Only set wallet_address if we have valid data, otherwise leave it null
        (data.user as any).wallet_address = walletData?.wallet_address || null;
        
        if (walletError) {
          console.warn('Could not fetch wallet address:', walletError);
        }
      }


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
