import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TopSharer {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_shares: number;
  total_earned: number;
  last_share_at: string;
}

export const useTopSharers = (campaignId: string | undefined, limit: number = 10) => {
  return useQuery({
    queryKey: ['top-sharers', campaignId, limit],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .rpc('get_campaign_top_sharers', { 
          campaign_uuid: campaignId,
          limit_count: limit 
        });

      if (error) {
        console.error('Error fetching top sharers:', error);
        throw error;
      }

      return (data || []) as TopSharer[];
    },
    enabled: !!campaignId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};
