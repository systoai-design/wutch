import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { shuffleWithBias } from '@/utils/trendingScore';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

interface LivestreamWithBounty extends Livestream {
  hasBounty?: boolean;
  hasShareCampaign?: boolean;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useStreamsQuery = () => {
  return useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      // Fetch all streams in parallel using status field for consistency
      const [liveResult, upcomingResult, endedResult, bountiesResult, campaignsResult] = await Promise.all([
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('status', 'live')
          .order('viewer_count', { ascending: false }),
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('status', 'pending')
          .order('started_at', { ascending: true }),
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('status', 'ended')
          .order('ended_at', { ascending: false })
          .limit(12),
        supabase
          .from('public_stream_bounties')
          .select('livestream_id'),
        supabase
          .from('sharing_campaigns')
          .select('livestream_id')
          .eq('is_active', true),
      ]);

      const bountyStreamIds = new Set(bountiesResult.data?.map(b => b.livestream_id) || []);
      const campaignStreamIds = new Set(campaignsResult.data?.map(c => c.livestream_id) || []);

      const addRewardInfo = (streams: any[]): LivestreamWithBounty[] =>
        streams?.map(stream => ({
          ...stream,
          hasBounty: bountyStreamIds.has(stream.id),
          hasShareCampaign: campaignStreamIds.has(stream.id),
        })) || [];

      // Apply randomization with quality bias
      return {
        liveStreams: shuffleWithBias(addRewardInfo(liveResult.data || []), 0.5),
        upcomingStreams: shuffleWithBias(addRewardInfo(upcomingResult.data || []), 0.5),
        endedStreams: shuffleWithBias(addRewardInfo(endedResult.data || []), 0.5),
      };
    },
    staleTime: 10000, // 10 seconds for live data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};
