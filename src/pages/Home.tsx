import { useState, useEffect } from 'react';
import StreamCard from '@/components/StreamCard';
import FilterBar from '@/components/FilterBar';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

const Home = () => {
  useEffect(() => {
    document.title = 'Home - Watch Live Streams | Wutch';
  }, []);
  const [streams, setStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const { data, error } = await supabase
          .from('livestreams')
          .select('*')
          .neq('status', 'ended')
          .order('created_at', { ascending: false });

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
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <FilterBar />
      
      <main className="p-4 lg:p-6">
        {streams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No live streams available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
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
