import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StreamCard from '@/components/StreamCard';
import FilterBar, { FilterOption } from '@/components/FilterBar';
import { Skeleton } from '@/components/ui/skeleton';
import { useStreamsQuery } from '@/hooks/useStreamsQuery';

const Streams = () => {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') as FilterOption || 'all';
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);

  const { data, isLoading } = useStreamsQuery();

  useEffect(() => {
    document.title = 'Live Streams | Wutch';
  }, []);

  useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  const getFilteredStreams = () => {
    if (!data) return [];
    
    const { liveStreams, upcomingStreams, endedStreams } = data;
    let allStreams = [...liveStreams, ...upcomingStreams, ...endedStreams];
    
    switch (activeFilter) {
      case 'live':
        return liveStreams;
      case 'upcoming':
        return upcomingStreams;
      case 'recent':
        return endedStreams;
      case 'with-rewards':
        return allStreams.filter(s => s.hasBounty || s.hasShareCampaign);
      case 'with-bounty':
        return allStreams.filter(s => s.hasBounty);
      case 'trending':
        return [...liveStreams].sort((a, b) => (b.viewer_count || 0) - (a.viewer_count || 0));
      default:
        return allStreams;
    }
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
              <StreamCard 
                key={stream.id} 
                stream={stream} 
                hasBounty={stream.hasBounty} 
                hasShareCampaign={stream.hasShareCampaign}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Streams;
