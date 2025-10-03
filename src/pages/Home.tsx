import { useState, useEffect } from 'react';
import StreamCard from '@/components/StreamCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

const Home = () => {
  useEffect(() => {
    document.title = 'Home - Watch Live Streams | Wutch';
  }, []);
  const [streams, setStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        setIsLoading(true);
        let query = supabase.from('livestreams').select('*');

        // Apply filters based on activeFilter
        switch (activeFilter) {
          case 'live':
            query = query.eq('is_live', true).order('viewer_count', { ascending: false });
            break;
          case 'recent':
            query = query.eq('status', 'ended').order('ended_at', { ascending: false });
            break;
          case 'trending':
            query = query.neq('status', 'ended').order('viewer_count', { ascending: false });
            break;
          case 'all':
          default:
            query = query.neq('status', 'ended').order('created_at', { ascending: false });
            break;
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching streams:', error);
          return;
        }

        setStreams(data || []);
      } catch (error) {
        console.error('Error fetching streams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreams();
  }, [activeFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      
      <main className="p-4 lg:p-6 max-w-[2000px] mx-auto">
        {streams.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              {activeFilter === 'live' && 'No live streams at the moment.'}
              {activeFilter === 'recent' && 'No recently ended streams.'}
              {activeFilter === 'trending' && 'No trending streams right now.'}
              {activeFilter === 'all' && 'No streams available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-5">
            {streams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
