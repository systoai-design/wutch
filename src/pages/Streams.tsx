import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import StreamCard from '@/components/StreamCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

interface LivestreamWithBounty extends Livestream {
  hasBounty?: boolean;
  profiles?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

const Streams = () => {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') as FilterOption || 'all';
  
  const [liveStreams, setLiveStreams] = useState<LivestreamWithBounty[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<LivestreamWithBounty[]>([]);
  const [endedStreams, setEndedStreams] = useState<LivestreamWithBounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);

  useEffect(() => {
    document.title = 'Live Streams | Wutch';
  }, []);

  useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      // Fetch live streams
      const { data: liveData } = await supabase
        .from('livestreams')
        .select(`
          *,
          profiles!livestreams_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });

      // Fetch upcoming streams
      const { data: upcomingData } = await supabase
        .from('livestreams')
        .select(`
          *,
          profiles!livestreams_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('is_live', false)
        .gte('started_at', new Date().toISOString())
        .is('ended_at', null)
        .order('started_at', { ascending: true });

      // Fetch ended streams
      const { data: endedData } = await supabase
        .from('livestreams')
        .select(`
          *,
          profiles!livestreams_user_id_fkey (username, display_name, avatar_url)
        `)
        .eq('is_live', false)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(12);

      // Check for bounties
      const { data: bounties } = await supabase
        .from('stream_bounties')
        .select('livestream_id')
        .eq('is_active', true);

      const bountyStreamIds = new Set(bounties?.map(b => b.livestream_id) || []);

      const addBountyInfo = (streams: any[]) =>
        streams?.map(stream => ({
          ...stream,
          hasBounty: bountyStreamIds.has(stream.id),
        })) || [];

      setLiveStreams(addBountyInfo(liveData));
      setUpcomingStreams(addBountyInfo(upcomingData));
      setEndedStreams(addBountyInfo(endedData));
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredStreams = () => {
    let allStreams: LivestreamWithBounty[] = [];
    
    switch (activeFilter) {
      case 'live':
        allStreams = liveStreams;
        break;
      case 'upcoming':
        allStreams = upcomingStreams;
        break;
      case 'recent':
        allStreams = endedStreams;
        break;
      case 'with-bounty':
        allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams].filter(s => s.hasBounty);
        break;
      case 'without-bounty':
        allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams].filter(s => !s.hasBounty);
        break;
      case 'trending':
        allStreams = [...liveStreams].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
        break;
      default:
        allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams];
    }
    
    return allStreams;
  };

  const filteredStreams = getFilteredStreams();

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <div className="p-4 md:p-6">
        {filteredStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-muted-foreground">No streams found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} hasBounty={stream.hasBounty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Streams;
