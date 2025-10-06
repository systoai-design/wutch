import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';

type WutchVideo = Database['public']['Tables']['wutch_videos']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
};

const WutchVideos = () => {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') as FilterOption || 'all';
  
  const [videos, setVideos] = useState<WutchVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);

  useEffect(() => {
    document.title = 'Wutch Videos | Wutch';
  }, []);

  useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  useEffect(() => {
    fetchVideos();
  }, [activeFilter]);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('wutch_videos')
        .select(`
          *
        `)
        .eq('status', 'published');

      // Apply sorting based on filter
      switch (activeFilter) {
        case 'trending':
          query = query.order('view_count', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(24);

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(v => v.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const videosWithProfiles = data.map(video => ({
          ...video,
          profiles: profilesMap.get(video.user_id),
        }));
        
        setVideos(videosWithProfiles as WutchVideo[]);
      } else {
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
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
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-muted-foreground">No videos found</p>
            <p className="text-sm text-muted-foreground mt-2">Be the first to upload a video!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {videos.map((video) => (
              <WutchVideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WutchVideos;
