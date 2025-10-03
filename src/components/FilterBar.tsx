import { Button } from '@/components/ui/button';
import { Circle } from 'lucide-react';

export type FilterOption = 'all' | 'live' | 'recent' | 'trending';

interface FilterBarProps {
  activeFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
}

const FilterBar = ({ activeFilter, onFilterChange }: FilterBarProps) => {
  const filters: { label: string; value: FilterOption; icon?: typeof Circle }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live Now', value: 'live', icon: Circle },
    { label: 'Recently Ended', value: 'recent' },
    { label: 'Trending', value: 'trending' },
  ];

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-16 z-40">
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.value;
          return (
            <Button
              key={filter.value}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange(filter.value)}
              className={`whitespace-nowrap rounded-full transition-all duration-200 ${
                isActive 
                  ? 'shadow-md' 
                  : 'hover:bg-accent/80'
              }`}
            >
              {Icon && (
                <Icon 
                  className={`h-3 w-3 mr-1.5 ${
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
