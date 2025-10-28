import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useCommunityPosts = () => {
  const { user } = useAuth();

  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["community-posts"],
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
            is_verified,
            verification_type
          )
        `)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Check if user has liked each post
      if (user) {
        const { data: likes } = await supabase
          .from("community_post_likes")
          .select("post_id")
          .eq("user_id", user.id);

        const likedPostIds = new Set(likes?.map(l => l.post_id) || []);
        
        return data.map(post => ({
          ...post,
          isLiked: likedPostIds.has(post.id),
        }));
      }

      return data.map(post => ({ ...post, isLiked: false }));
    },
  });

  return { posts: posts || [], isLoading, refetch };
};
