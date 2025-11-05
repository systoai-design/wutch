import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignAnalytics {
  campaign_id: string;
  content_id: string;
  content_type: 'livestream' | 'short_video' | 'wutch_video';
  content_title: string;
  reward_per_share: number;
  total_budget: number;
  spent_budget: number;
  total_shares: number;
  unique_sharers: number;
  twitter_shares: number;
  total_rewards_paid: number;
  pending_rewards: number;
  avg_reward_per_share: number;
  conversion_rate: number;
  created_at: string;
  is_active: boolean;
}

export const useCampaignAnalytics = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['campaign-analytics', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .rpc('get_campaign_analytics', { creator_user_id: userId });

      if (error) {
        console.error('Error fetching campaign analytics:', error);
        throw error;
      }

      return (data || []) as CampaignAnalytics[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
};
