import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import { useWutchVideosQuery } from '@/hooks/useWutchVideosQuery';

const WutchVideos = () => {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') as FilterOption || 'all';
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);

  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useWutchVideosQuery(activeFilter);

  const videos = data?.pages.flat() || [];

  useEffect(() => {
    document.title = 'Wutch Videos | Wutch';
  }, []);

  useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    
    // Calculate if we're near the bottom (5 videos from end)
    const scrollPosition = window.innerHeight + window.scrollY;
    const bottomPosition = document.documentElement.scrollHeight - 1000; // ~5 video cards
    
    if (scrollPosition >= bottomPosition) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <div className="p-4 md:p-6">
          	<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl shadow-sm" />
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {videos.map((video) => (
                <WutchVideoCard key={video.id} video={video} />
              ))}
            </div>
            
            {/* Loading indicator for next page */}
            {isFetchingNextPage && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video w-full rounded-xl shadow-sm" />
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WutchVideos;
