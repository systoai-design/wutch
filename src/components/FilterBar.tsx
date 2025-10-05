import { Button } from '@/components/ui/button';
import { Circle, Coins } from 'lucide-react';

export type FilterOption = 'all' | 'live' | 'recent' | 'trending' | 'with-bounty' | 'without-bounty';

interface FilterBarProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

const FilterBar = ({ activeFilter, onFilterChange }: FilterBarProps) => {
  const filters: { label: string; value: FilterOption; icon?: typeof Circle }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live Now', value: 'live', icon: Circle },
    { label: 'With Bounty', value: 'with-bounty', icon: Coins },
    { label: 'Without Bounty', value: 'without-bounty' },
    { label: 'Recently Ended', value: 'recent' },
    { label: 'Trending', value: 'trending' },
  ];

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-[56px] sm:top-[64px] z-40">
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory touch-manipulation">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.value;
          return (
            <Button
              key={filter.value}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange(filter.value)}
              className={`whitespace-nowrap rounded-full transition-all duration-200 snap-start flex-shrink-0 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4 ${
                isActive 
                  ? 'shadow-md' 
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
  );
};

export default FilterBar;
