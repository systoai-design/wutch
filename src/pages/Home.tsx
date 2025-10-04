import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

const Home = () => {
  useEffect(() => {
    document.title = 'Home - Watch Live Streams | Wutch';
  }, []);
  const [searchParams] = useSearchParams();
  const [liveStreams, setLiveStreams] = useState<Livestream[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<Livestream[]>([]);
  const [endedStreams, setEndedStreams] = useState<Livestream[]>([]);
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
