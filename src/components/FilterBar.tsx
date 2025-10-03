import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Circle } from 'lucide-react';

type FilterOption = 'all' | 'live' | 'recent' | 'trending';

const FilterBar = () => {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const filters: { label: string; value: FilterOption; icon?: typeof Circle }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live Now', value: 'live', icon: Circle },
    { label: 'Recently Ended', value: 'recent' },
    { label: 'Trending', value: 'trending' },
  ];

  return (
    <div className="border-b border-border bg-background sticky top-16 z-40">
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {filters.map((filter) => {
          const Icon = filter.icon;
          return (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter(filter.value)}
              className="whitespace-nowrap"
            >
              {Icon && <Icon className="h-3 w-3 mr-1 fill-current" />}
              {filter.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;
