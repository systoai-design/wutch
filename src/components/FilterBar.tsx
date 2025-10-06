import { Button } from '@/components/ui/button';
import { Circle, Coins } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type FilterOption = 'all' | 'live' | 'recent' | 'trending' | 'upcoming' | 'with-bounty' | 'without-bounty' | 'with-rewards';

interface FilterBarProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

const FilterBar = ({ activeFilter, onFilterChange }: FilterBarProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(true);
  
  const filters: { label: string; value: FilterOption; icon?: typeof Circle }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live Now', value: 'live', icon: Circle },
    { label: 'With Rewards 💰', value: 'with-rewards' },
    { label: 'With Bounty', value: 'with-bounty', icon: Coins },
    { label: 'Without Bounty', value: 'without-bounty' },
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Recently Ended', value: 'recent' },
    { label: 'Trending', value: 'trending' },
  ];

  // Handle scroll position to show/hide gradients
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftGradient(scrollLeft > 10);
    setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 10);
  };

  // Auto-scroll active filter into view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const activeButton = container.querySelector(`[data-filter="${activeFilter}"]`);
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeFilter]);

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-[56px] sm:top-[64px] z-40">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        {/* Semi-rounded container */}
        <div className="relative bg-muted/30 rounded-2xl p-1.5 border border-border/50 shadow-sm">
          {/* Left gradient indicator */}
          <div 
            className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-muted/30 to-transparent pointer-events-none z-10 transition-opacity duration-300 rounded-l-2xl ${
              showLeftGradient ? 'opacity-100' : 'opacity-0'
            }`}
          />
          
          {/* Right gradient indicator */}
          <div 
            className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-muted/30 to-transparent pointer-events-none z-10 transition-opacity duration-300 rounded-r-2xl ${
              showRightGradient ? 'opacity-100' : 'opacity-0'
            }`}
          />
          
          {/* Scrollable filter buttons */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide snap-x snap-proximity touch-manipulation scroll-smooth carousel-scroll"
          >
            {filters.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeFilter === filter.value;
              return (
                <Button
                  key={filter.value}
                  data-filter={filter.value}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onFilterChange(filter.value)}
                  className={`whitespace-nowrap rounded-full transition-all duration-200 snap-center flex-shrink-0 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm px-3 sm:px-4 ${
                    isActive 
                      ? 'shadow-md hover:shadow-lg' 
                      : 'hover:bg-accent/80'
                  }`}
                >
                  {Icon && (
                    <Icon 
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5 ${
                        filter.value === 'live' && isActive ? 'fill-current animate-pulse' : 'fill-current'
                      }`} 
                    />
                  )}
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
