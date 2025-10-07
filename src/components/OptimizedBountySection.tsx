import { BountyCard } from './BountyCard';
import { Skeleton } from './ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface OptimizedBountySectionProps {
  bounties: any[];
  isLoading: boolean;
}

export const OptimizedBountySection = ({ bounties, isLoading }: OptimizedBountySectionProps) => {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!bounties?.length) {
    return null;
  }

  return (
    <Carousel className="w-full max-w-7xl mx-auto">
      <CarouselContent className="-ml-2 md:-ml-4">
        {bounties.map((bounty) => (
          <CarouselItem key={bounty.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
            <BountyCard bounty={bounty} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:flex" />
      <CarouselNext className="hidden md:flex" />
    </Carousel>
  );
};
