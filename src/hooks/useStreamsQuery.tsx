import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

interface LivestreamWithBounty extends Livestream {
  hasBounty?: boolean;
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
      // Fetch all streams in parallel
      const [liveResult, upcomingResult, endedResult, bountiesResult] = await Promise.all([
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('is_live', true)
          .order('viewer_count', { ascending: false }),
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('is_live', false)
          .gte('started_at', new Date().toISOString())
          .is('ended_at', null)
          .order('started_at', { ascending: true }),
        supabase
          .from('livestreams')
          .select('*, profiles!livestreams_user_id_fkey (username, display_name, avatar_url)')
          .eq('is_live', false)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(12),
        supabase
          .from('stream_bounties')
          .select('livestream_id')
          .eq('is_active', true),
      ]);

      const bountyStreamIds = new Set(bountiesResult.data?.map(b => b.livestream_id) || []);

      const addBountyInfo = (streams: any[]): LivestreamWithBounty[] =>
        streams?.map(stream => ({
          ...stream,
          hasBounty: bountyStreamIds.has(stream.id),
        })) || [];

      return {
        liveStreams: addBountyInfo(liveResult.data || []),
        upcomingStreams: addBountyInfo(upcomingResult.data || []),
        endedStreams: addBountyInfo(endedResult.data || []),
      };
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};
