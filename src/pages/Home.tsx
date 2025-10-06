import { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import { ShortCard } from '@/components/ShortCard';
import { WutchVideoCard } from '@/components/WutchVideoCard';
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
  has_active_share_campaign?: boolean;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};
type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'>;
};

type WutchVideo = Pick<Database['public']['Tables']['wutch_videos']['Row'], 
  'id' | 'title' | 'thumbnail_url' | 'video_url' | 'duration' | 'view_count' | 'like_count' | 'created_at' | 'category' | 'user_id' | 'status'
> & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'>;
  trending_score?: number;
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
  const [wutchVideos, setWutchVideos] = useState<WutchVideo[]>([]);
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

      // Fetch live streams with bounty and share campaign info
      let liveQuery = supabase
        .from('livestreams')
        .select(`
          *,
          profiles!livestreams_user_id_fkey(username, display_name, avatar_url),
          stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit),
          sharing_campaigns!livestream_id(id, is_active)
        `)
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });
      liveQuery = buildQuery(liveQuery);
      const { data: liveData } = await liveQuery;
      
      // Process bounty and share campaign data
      const processedLiveData: LivestreamWithBounty[] = (liveData || []).map(stream => {
        const activeBounties = (stream.stream_bounties as any[] || []).filter((b: any) => b.is_active);
        const activeCampaigns = (stream.sharing_campaigns as any[] || []).filter((c: any) => c.is_active);
        return {
          ...stream,
          bounty_count: activeBounties.length,
          has_active_bounty: activeBounties.length > 0,
          has_active_share_campaign: activeCampaigns.length > 0,
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

      // Fetch wutch videos and profiles in parallel
      const [wutchResult, profilesResult] = await Promise.all([
        supabase
          .from('wutch_videos')
          .select('id, title, thumbnail_url, video_url, duration, view_count, like_count, created_at, category, user_id, status')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
      ]);

      const wutchData = wutchResult.data || [];
      
      // Create profiles map
      const profilesMap = new Map(
        (profilesResult.data || []).map(p => [p.id, p])
      );

      // Calculate trending score for wutch videos
      const now = Date.now();
      const wutchWithScore = wutchData.map((video) => {
        const ageInDays = (now - new Date(video.created_at || '').getTime()) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 100 - ageInDays * 10);
        const trendingScore = 
          (video.view_count || 0) * 0.7 + 
          (video.like_count || 0) * 0.2 + 
          recencyBonus * 0.1;
        const profile = profilesMap.get(video.user_id);
        return { 
          ...video,
          profiles: profile ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url
          } : undefined,
          trending_score: trendingScore 
        };
      }).sort((a, b) => (b.trending_score || 0) - (a.trending_score || 0));

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
      setWutchVideos(wutchWithScore);
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

  // Filter content based on active filter (returns mixed streams and videos)
  const getFilteredContent = () => {
    const allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams];
    
    switch (activeFilter) {
      case 'live':
        return { streams: liveStreams, videos: [] };
      case 'recent':
        return { streams: endedStreams, videos: wutchVideos.slice(0, 9) };
      case 'trending':
        // Mix trending streams and videos
        return { 
          streams: [...liveStreams].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0)).slice(0, 9),
          videos: wutchVideos.slice(0, 9)
        };
      case 'with-rewards':
        return {
          streams: allStreams.filter(stream => stream.has_active_bounty || stream.has_active_share_campaign),
          videos: []
        };
      case 'with-bounty':
        return { 
          streams: allStreams.filter(stream => stream.has_active_bounty),
          videos: []
        };
      case 'without-bounty':
        return { 
          streams: allStreams.filter(stream => !stream.has_active_bounty),
          videos: []
        };
      case 'upcoming':
        return { streams: upcomingStreams, videos: [] };
      case 'all':
      default:
        return { streams: [], videos: [] };
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
          <div className="space-y-8">
            {(() => {
              const filteredContent = getFilteredContent();
              return (filteredContent.streams.length > 0 || filteredContent.videos.length > 0) ? (
                <>
                  {filteredContent.streams.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold">
                          {activeFilter === 'live' && 'Live Streams'}
                          {activeFilter === 'recent' && 'Recently Ended'}
                          {activeFilter === 'trending' && 'Trending Streams'}
                          {activeFilter === 'upcoming' && 'Upcoming Streams'}
                          {activeFilter === 'with-rewards' && 'Streams with Rewards 💰'}
                          {activeFilter === 'with-bounty' && 'Streams with Bounties'}
                          {activeFilter === 'without-bounty' && 'Streams without Bounties'}
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {filteredContent.streams.map((stream) => (
                          <StreamCard 
                            key={stream.id} 
                            stream={stream} 
                            hasBounty={stream.has_active_bounty} 
                            hasShareCampaign={stream.has_active_share_campaign}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  
                  {filteredContent.videos.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold">
                          {activeFilter === 'trending' && 'Trending Videos'}
                          {activeFilter === 'recent' && 'Recent Videos'}
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {filteredContent.videos.map((video) => (
                          <WutchVideoCard key={video.id} video={video} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-muted-foreground text-lg">
                    {activeFilter === 'live' && 'No live streams at the moment.'}
                    {activeFilter === 'recent' && 'No recently ended streams or videos.'}
                    {activeFilter === 'trending' && 'No trending content right now.'}
                    {activeFilter === 'with-bounty' && 'No streams with bounties available.'}
                    {activeFilter === 'without-bounty' && 'No streams without bounties.'}
                    {activeFilter === 'upcoming' && 'No upcoming streams.'}
                  </p>
                </div>
              );
            })()}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {liveStreams.slice(0, 9).map((stream) => (
                    <StreamCard 
                      key={stream.id} 
                      stream={stream} 
                      hasBounty={stream.has_active_bounty}
                      hasShareCampaign={stream.has_active_share_campaign}
                    />
                  ))}
                </div>
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

            {/* Wutch Videos Section */}
            {wutchVideos.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Trending Wutch Videos</h2>
                  <Link to="/wutch">
                    <Button variant="ghost" size="sm" className="gap-2 min-h-[44px]">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {wutchVideos.slice(0, 9).map((video) => (
                    <WutchVideoCard key={video.id} video={video} />
                  ))}
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {upcomingStreams.slice(0, 9).map((stream) => (
                    <StreamCard key={stream.id} stream={stream} hasBounty={stream.has_active_bounty} />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {endedStreams.slice(0, 9).map((stream) => (
                    <StreamCard key={stream.id} stream={stream} hasBounty={stream.has_active_bounty} />
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
