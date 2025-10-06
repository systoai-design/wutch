import { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import { ShortCard } from '@/components/ShortCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useIsMobile } from '@/hooks/use-mobile';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type LivestreamWithBounty = Livestream & {
  bounty_count?: number;
  total_available_rewards?: number;
  has_active_bounty?: boolean;
};
type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'>;
};

const Home = () => {
  const location = useLocation();
  
  useEffect(() => {
    document.title = 'Home - Watch Live Streams | Wutch';
  }, []);
  const [searchParams] = useSearchParams();
  const [liveStreams, setLiveStreams] = useState<LivestreamWithBounty[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<LivestreamWithBounty[]>([]);
  const [endedStreams, setEndedStreams] = useState<LivestreamWithBounty[]>([]);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category')
  );
  const isMobile = useIsMobile();

  // Set filter based on current route
  useEffect(() => {
    if (location.pathname === '/trending') {
      setActiveFilter('trending');
    } else if (location.pathname === '/upcoming') {
      setActiveFilter('upcoming');
    } else if (location.pathname === '/recent') {
      setActiveFilter('recent');
    } else {
      setActiveFilter('all');
    }
  }, [location.pathname]);

  useEffect(() => {
    fetchAllStreams();
  }, [activeFilter, selectedCategory]);

  const fetchAllStreams = async () => {
    try {
      setIsLoading(true);

      // Base query with category filter
      const buildQuery = (baseQuery: any) => {
        if (selectedCategory) {
          baseQuery = baseQuery.eq('category', selectedCategory);
        }
        return baseQuery;
      };

      // Fetch live streams with bounty info
      let liveQuery = supabase
        .from('livestreams')
        .select(`
          *,
          stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit)
        `)
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });
      liveQuery = buildQuery(liveQuery);
      const { data: liveData } = await liveQuery;
      
      // Process bounty data
      const processedLiveData: LivestreamWithBounty[] = (liveData || []).map(stream => {
        const activeBounties = (stream.stream_bounties as any[] || []).filter((b: any) => b.is_active);
        return {
          ...stream,
          bounty_count: activeBounties.length,
          has_active_bounty: activeBounties.length > 0,
          total_available_rewards: activeBounties.reduce((sum: number, b: any) => 
            sum + (b.reward_per_participant * (b.participant_limit - b.claimed_count)), 0
          )
        };
      });

      // Fetch shorts
      const { data: shortsData } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey(username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      // Fetch upcoming streams with bounty info
      let upcomingQuery = supabase
        .from('livestreams')
        .select(`
          *,
          stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      upcomingQuery = buildQuery(upcomingQuery);
      const { data: upcomingData } = await upcomingQuery;
      
      const processedUpcomingData: LivestreamWithBounty[] = (upcomingData || []).map(stream => {
        const activeBounties = (stream.stream_bounties as any[] || []).filter((b: any) => b.is_active);
        return {
          ...stream,
          bounty_count: activeBounties.length,
          has_active_bounty: activeBounties.length > 0,
          total_available_rewards: activeBounties.reduce((sum: number, b: any) => 
            sum + (b.reward_per_participant * (b.participant_limit - b.claimed_count)), 0
          )
        };
      });

      // Fetch ended streams with bounty info
      let endedQuery = supabase
        .from('livestreams')
        .select(`
          *,
          stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit)
        `)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(50);
      endedQuery = buildQuery(endedQuery);
      const { data: endedData } = await endedQuery;
      
      const processedEndedData: LivestreamWithBounty[] = (endedData || []).map(stream => {
        const activeBounties = (stream.stream_bounties as any[] || []).filter((b: any) => b.is_active);
        return {
          ...stream,
          bounty_count: activeBounties.length,
          has_active_bounty: activeBounties.length > 0,
          total_available_rewards: activeBounties.reduce((sum: number, b: any) => 
            sum + (b.reward_per_participant * (b.participant_limit - b.claimed_count)), 0
          )
        };
      });

      // Sort: bounty streams first, then by viewer count
      const sortedLive = processedLiveData.sort((a, b) => {
        if (a.has_active_bounty && !b.has_active_bounty) return -1;
        if (!a.has_active_bounty && b.has_active_bounty) return 1;
        return (b.viewer_count || 0) - (a.viewer_count || 0);
      });

      // Sort: bounty streams first for upcoming
      const sortedUpcoming = processedUpcomingData.sort((a, b) => {
        if (a.has_active_bounty && !b.has_active_bounty) return -1;
        if (!a.has_active_bounty && b.has_active_bounty) return 1;
        return 0;
      });

      // Sort: bounty streams first for ended
      const sortedEnded = processedEndedData.sort((a, b) => {
        if (a.has_active_bounty && !b.has_active_bounty) return -1;
        if (!a.has_active_bounty && b.has_active_bounty) return 1;
        return 0;
      });

      setLiveStreams(sortedLive);
      setShorts(shortsData || []);
      setUpcomingStreams(sortedUpcoming);
      setEndedStreams(sortedEnded);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getFilteredStreams = () => {
    const allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams];
    
    switch (activeFilter) {
      case 'live':
        return liveStreams;
      case 'recent':
        return endedStreams;
      case 'trending':
        return [...liveStreams].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
      case 'with-bounty':
        return allStreams.filter(stream => stream.has_active_bounty);
      case 'without-bounty':
        return allStreams.filter(stream => !stream.has_active_bounty);
      default:
        return allStreams;
    }
  };

  return (
    <div>
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <main className="p-3 sm:p-4 lg:p-6 max-w-[2000px] mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : activeFilter !== 'all' ? (
          <div className="space-y-6">
            {getFilteredStreams().length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  {activeFilter === 'live' && 'No live streams at the moment.'}
                  {activeFilter === 'recent' && 'No recently ended streams.'}
                  {activeFilter === 'trending' && 'No trending streams right now.'}
                  {activeFilter === 'with-bounty' && 'No streams with bounties available.'}
                  {activeFilter === 'without-bounty' && 'No streams without bounties.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-5">
                {getFilteredStreams().map((stream) => (
                  <StreamCard key={stream.id} stream={stream} compact hasBounty={stream.has_active_bounty} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Live Now Section */}
            {liveStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    Live Now
                    <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-normal text-muted-foreground">
                      ({liveStreams.length})
                    </span>
                  </h2>
                </div>
                {isMobile ? (
                  <Carousel
                    opts={{
                      align: "start",
                      dragFree: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-2 sm:-ml-4">
                      {liveStreams.map((stream) => (
                        <CarouselItem key={stream.id} className="pl-2 sm:pl-4 basis-[60%] xs:basis-[55%] sm:basis-1/2">
                          <StreamCard stream={stream} compact hasBounty={stream.has_active_bounty} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                ) : (
                  <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                    <div className="flex gap-4 pb-4">
                      {liveStreams.map((stream) => (
                        <div key={stream.id} className="flex-shrink-0 w-80">
                          <StreamCard stream={stream} hasBounty={stream.has_active_bounty} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Shorts Section */}
            {shorts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Shorts</h2>
                  <Link to="/shorts">
                    <Button variant="ghost" size="sm" className="gap-2 min-h-[44px]">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <Carousel
                  opts={{
                    align: "start",
                    dragFree: true,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2 sm:-ml-3">
                    {shorts.map((short) => (
                      <CarouselItem key={short.id} className="pl-2 sm:pl-3 basis-[45%] xs:basis-[38%] sm:basis-[30%] md:basis-[23%] lg:basis-[18%]">
                        <ShortCard short={short} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </section>
            )}

            {/* Upcoming Streams Section */}
            {upcomingStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    Upcoming Streams
                    <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                      ({upcomingStreams.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-5">
                  {upcomingStreams.map((stream) => (
                    <StreamCard key={stream.id} stream={stream} compact hasBounty={stream.has_active_bounty} />
                  ))}
                </div>
              </section>
            )}

            {/* Recently Ended Section */}
            {endedStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    Recently Ended
                    <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                      ({endedStreams.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-5">
                  {endedStreams.slice(0, 20).map((stream) => (
                    <StreamCard key={stream.id} stream={stream} compact hasBounty={stream.has_active_bounty} />
                  ))}
                </div>
                {endedStreams.length > 20 && (
                  <div className="text-center mt-6">
                    <Button variant="outline" size="lg">
                      Load More <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Empty State */}
            {liveStreams.length === 0 && upcomingStreams.length === 0 && endedStreams.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  {selectedCategory
                    ? `No streams in the "${selectedCategory}" category at the moment.`
                    : 'No streams available at the moment.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
