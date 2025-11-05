import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ActiveCampaignData {
  hasActiveCampaign: boolean;
  rewardPerShare: number | null;
  totalBudget: number | null;
  availableBudget: number | null;
}

export const useActiveCampaign = (contentId: string, contentType: 'livestream' | 'wutch_video' | 'short_video') => {
  return useQuery({
    queryKey: ['active-campaign', contentId, contentType],
    queryFn: async (): Promise<ActiveCampaignData> => {
      const { data, error } = await supabase
        .from('sharing_campaigns')
        .select('reward_per_share, total_budget, spent_budget')
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active campaign:', error);
        return {
          hasActiveCampaign: false,
          rewardPerShare: null,
          totalBudget: null,
          availableBudget: null,
        };
      }

      if (!data) {
        return {
          hasActiveCampaign: false,
          rewardPerShare: null,
          totalBudget: null,
          availableBudget: null,
        };
      }

      return {
        hasActiveCampaign: true,
        rewardPerShare: data.reward_per_share,
        totalBudget: data.total_budget,
        availableBudget: data.total_budget - (data.spent_budget || 0),
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};
