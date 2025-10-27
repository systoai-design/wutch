import { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation, useNavigate } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import { ShortCard } from '@/components/ShortCard';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { ChevronRight, X, Video, Zap, PlaySquare, Clock } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ScrollToTop } from '@/components/ScrollToTop';
import { SkeletonStreamCard } from '@/components/SkeletonCard';
import { SkeletonFeed, SkeletonCarousel } from '@/components/SkeletonFeed';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

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
  const navigate = useNavigate();
  
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

  // React to URL category changes  
  useEffect(() => {
    const urlCategory = searchParams.get('category');
    setSelectedCategory(urlCategory);
  }, [searchParams]);

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

      // Fetch all data in parallel for better performance
      const [liveResult, shortsResult, wutchResult, profilesResult, upcomingResult, endedResult] = await Promise.all([
        // Live streams
        buildQuery(supabase
          .from('livestreams')
          .select(`
            *,
            profiles!livestreams_user_id_fkey(username, display_name, avatar_url),
            public_stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit),
            sharing_campaigns!livestream_id(id, is_active)
          `)
          .eq('status', 'live')
          .order('viewer_count', { ascending: false })),
        
        // Shorts
        buildQuery(supabase
          .from('short_videos')
          .select(`
            *,
            profiles!short_videos_user_id_fkey(username, display_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(15)),
        
        // Wutch videos
        buildQuery(supabase
          .from('wutch_videos')
          .select('id, title, thumbnail_url, video_url, duration, view_count, like_count, created_at, category, user_id, status')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(12)),
        
        // Profiles for wutch videos
        supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url'),
        
        // Upcoming streams
        buildQuery(supabase
          .from('livestreams')
          .select(`
            *,
            public_stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })),
        
        // Ended streams
        buildQuery(supabase
          .from('livestreams')
          .select(`
            *,
            public_stream_bounties!livestream_id(id, is_active, reward_per_participant, claimed_count, participant_limit)
          `)
          .eq('status', 'ended')
          .order('ended_at', { ascending: false })
          .limit(12))
      ]);

      const liveData = liveResult.data;
      
      // Process bounty and share campaign data
      const processedLiveData: LivestreamWithBounty[] = (liveData || []).map(stream => {
        const activeBounties = (stream.public_stream_bounties as any[] || []).filter((b: any) => b.is_active);
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

      const shortsData = shortsResult.data;
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

      const upcomingData = upcomingResult.data;
      
      const processedUpcomingData: LivestreamWithBounty[] = (upcomingData || []).map(stream => {
        const activeBounties = (stream.public_stream_bounties as any[] || []).filter((b: any) => b.is_active);
        return {
          ...stream,
          bounty_count: activeBounties.length,
          has_active_bounty: activeBounties.length > 0,
          total_available_rewards: activeBounties.reduce((sum: number, b: any) => 
            sum + (b.reward_per_participant * (b.participant_limit - b.claimed_count)), 0
          )
        };
      });

      const endedData = endedResult.data;
      
      const processedEndedData: LivestreamWithBounty[] = (endedData || []).map(stream => {
        const activeBounties = (stream.public_stream_bounties as any[] || []).filter((b: any) => b.is_active);
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
      <main className="min-h-screen p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="h-10 w-48 bg-muted rounded-xl animate-pulse" />
          </div>
          <SkeletonFeed count={8} />
        </div>
        <ScrollToTop />
      </main>
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
        {/* Category Filter Badge */}
        {selectedCategory && (
          <div className="mb-6 flex items-center gap-2">
            <Badge variant="secondary" className="text-sm px-4 py-2">
              Showing: {selectedCategory}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory(null);
                window.history.pushState({}, '', '/app');
              }}
              className="h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
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
                        {filteredContent.streams.map((stream, index) => (
                          <div key={stream.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                            <StreamCard 
                              stream={stream} 
                              hasBounty={stream.has_active_bounty} 
                              hasShareCampaign={stream.has_active_share_campaign}
                            />
                          </div>
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
                        {filteredContent.videos.map((video, index) => (
                          <div key={video.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                            <WutchVideoCard video={video} />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={activeFilter === 'live' ? Video : activeFilter === 'upcoming' ? Clock : PlaySquare}
                  title={`No ${activeFilter === 'live' ? 'Live' : activeFilter === 'recent' ? 'Recent' : activeFilter === 'upcoming' ? 'Upcoming' : 'Trending'} Content`}
                  description={
                    activeFilter === 'live' 
                      ? 'No live streams at the moment. Check back soon!' 
                      : activeFilter === 'recent'
                      ? 'No recently ended streams or videos yet.'
                      : activeFilter === 'trending'
                      ? 'No trending content right now.'
                      : activeFilter === 'with-bounty'
                      ? 'No streams with bounties available.'
                      : activeFilter === 'without-bounty'
                      ? 'No streams without bounties.'
                      : 'No upcoming streams scheduled.'
                  }
                  action={{
                    label: 'View All Streams',
                    onClick: () => setActiveFilter('all')
                  }}
                />
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
                  {liveStreams.slice(0, 9).map((stream, index) => (
                    <div key={stream.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                      <StreamCard
                        stream={stream} 
                        hasBounty={stream.has_active_bounty} 
                        hasShareCampaign={stream.has_active_share_campaign}
                      />
                    </div>
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
                {/* Carousel container with semi-rounded corners */}
                <div className="carousel-container">
                  <Carousel
                    opts={{
                      align: "start",
                      dragFree: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-2 sm:-ml-3">
                      {shorts.map((short, index) => (
                        <CarouselItem key={short.id} className="pl-2 sm:pl-3 basis-[45%] xs:basis-[38%] sm:basis-[30%] md:basis-[23%] lg:basis-[18%] animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                          <ShortCard short={short} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
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
                {/* Carousel container with semi-rounded corners */}
                <div className="carousel-container">
                  <Carousel
                    opts={{
                      align: "start",
                      dragFree: true,
                    }}
                    className="w-full"
                  >
                    <CarouselContent className="-ml-2 sm:-ml-3">
                      {wutchVideos.slice(0, 12).map((video, index) => (
                        <CarouselItem key={video.id} className="pl-2 sm:pl-3 basis-[85%] xs:basis-[70%] sm:basis-[50%] md:basis-[40%] lg:basis-[33%] xl:basis-[25%] animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                          <WutchVideoCard video={video} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
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
                  {upcomingStreams.slice(0, 9).map((stream, index) => (
                    <div key={stream.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                      <StreamCard stream={stream} hasBounty={stream.has_active_bounty} />
                    </div>
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
                  {endedStreams.slice(0, 9).map((stream, index) => (
                    <div key={stream.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                      <StreamCard stream={stream} hasBounty={stream.has_active_bounty} />
                    </div>
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
            {liveStreams.length === 0 && upcomingStreams.length === 0 && endedStreams.length === 0 && shorts.length === 0 && wutchVideos.length === 0 && (
              <EmptyState
                icon={Video}
                title={selectedCategory ? `No Streams in "${selectedCategory}"` : 'No Content Available'}
                description={
                  selectedCategory
                    ? `No streams found in the "${selectedCategory}" category at the moment. Try a different category or check back later!`
                    : 'No streams or videos available at the moment. Be the first to go live!'
                }
                action={{
                  label: selectedCategory ? 'Clear Filter' : 'Start Streaming',
                  onClick: () => selectedCategory ? navigate('/app') : navigate('/submit')
                }}
              />
            )}
          </div>
        )}
        <ScrollToTop />
      </main>
    </div>
  );
};

export default Home;
