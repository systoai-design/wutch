import { Skeleton } from '@/components/ui/skeleton';

export const SkeletonFeed = ({ count = 8 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-video rounded-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonCarousel = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[280px] sm:w-[320px] space-y-2">
          <Skeleton className="aspect-[9/16] rounded-xl" />
        </div>
      ))}
    </div>
  );
};
