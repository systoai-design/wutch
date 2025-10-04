import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import ShortCard from '@/components/ShortCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, DollarSign } from 'lucide-react';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'>;
};

const Home = () => {
  useEffect(() => {
    document.title = 'Home - Watch Live Streams | Wutch';
  }, []);
  const [searchParams] = useSearchParams();
  const [liveStreams, setLiveStreams] = useState<Livestream[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<Livestream[]>([]);
  const [endedStreams, setEndedStreams] = useState<Livestream[]>([]);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category')
  );

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

      // Fetch live streams
      let liveQuery = supabase
        .from('livestreams')
        .select('*')
        .eq('is_live', true)
        .order('viewer_count', { ascending: false });
      liveQuery = buildQuery(liveQuery);
      const { data: liveData } = await liveQuery;

      // Fetch shorts
      const { data: shortsData } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey(username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      // Fetch upcoming streams (pending status)
      let upcomingQuery = supabase
        .from('livestreams')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      upcomingQuery = buildQuery(upcomingQuery);
      const { data: upcomingData } = await upcomingQuery;

      // Fetch ended streams
      let endedQuery = supabase
        .from('livestreams')
        .select('*')
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(50);
      endedQuery = buildQuery(endedQuery);
      const { data: endedData } = await endedQuery;

      setLiveStreams(liveData || []);
      setShorts(shortsData || []);
      setUpcomingStreams(upcomingData || []);
      setEndedStreams(endedData || []);
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
    switch (activeFilter) {
      case 'live':
        return liveStreams;
      case 'recent':
        return endedStreams;
      case 'trending':
        return [...liveStreams].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
      default:
        return [...liveStreams, ...upcomingStreams, ...endedStreams];
    }
  };

  return (
    <div>
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <main className="p-4 lg:p-6 max-w-[2000px] mx-auto">
        {/* Earnings Info Banner */}
        <Card className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-chart-1/10 border-primary/20">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                💰 Earn SOL from Views! Livestreams: $2/1K views • Shorts: $1.50/1K views
              </p>
            </div>
          </div>
        </Card>
        
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
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-5">
                {getFilteredStreams().map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
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
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    Live Now
                    <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                      ({liveStreams.length})
                    </span>
                  </h2>
                </div>
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-4 pb-4">
                    {liveStreams.map((stream) => (
                      <div key={stream.id} className="flex-shrink-0 w-80">
                        <StreamCard stream={stream} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Shorts Section */}
            {shorts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Shorts</h2>
                  <Link to="/shorts">
                    <Button variant="ghost" size="sm" className="gap-2">
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                  <div className="flex gap-3 pb-4">
                    {shorts.map((short) => (
                      <div key={short.id} className="flex-shrink-0 w-40">
                        <ShortCard short={short} />
                      </div>
                    ))}
                  </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-5">
                  {upcomingStreams.map((stream) => (
                    <StreamCard key={stream.id} stream={stream} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-5">
                  {endedStreams.slice(0, 20).map((stream) => (
                    <StreamCard key={stream.id} stream={stream} />
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
