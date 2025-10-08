import { Skeleton } from '@/components/ui/skeleton';

export const SkeletonStreamCard = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <Skeleton className={`aspect-video rounded-xl ${compact ? 'rounded-lg' : ''}`} />
      <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
        <Skeleton className={`rounded-full flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-9 h-9'}`} />
        <div className="flex-1 space-y-2">
          <Skeleton className={`h-4 w-full ${compact ? 'h-3' : ''}`} />
          <Skeleton className={`h-3 w-2/3 ${compact ? 'h-2.5' : ''}`} />
        </div>
      </div>
    </div>
  );
};

export const SkeletonShortCard = () => {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[9/16] rounded-xl" />
    </div>
  );
};

export const SkeletonVideoCard = () => {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-video rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
};
