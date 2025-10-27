import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useServiceReviews = (postId: string) => {
  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ["service-reviews", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_reviews")
        .select(`
          *,
          buyer:profiles!service_reviews_buyer_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          seller:profiles!service_reviews_seller_id_fkey (
            username,
            display_name
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });

  return { reviews: reviews || [], isLoading, refetch };
};
