import { useState, useEffect } from 'react';
import { ShortCard } from '@/components/ShortCard';
import { ShortVideoModal } from '@/components/ShortVideoModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useShortsQuery } from '@/hooks/useShortsQuery';
import type { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

const Shorts = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedShort, setSelectedShort] = useState<ShortVideo | null>(null);

  const { data: shorts = [], isLoading } = useShortsQuery();

  useEffect(() => {
    document.title = 'Shorts | Wutch';
  }, []);

  const handleShortClick = (shortId: string) => {
    const short = shorts.find(s => s.id === shortId);
    if (short) {
      setSelectedShort(short);
      setIsModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <div className="p-4">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[9/16] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No shorts available</p>
          <p className="text-sm text-muted-foreground mt-2">Be the first to upload!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Shorts</h1>
        
        {/* 2-column grid on mobile, 3+ on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
          {shorts.map((short) => (
            <ShortCard 
              key={short.id} 
              short={short} 
              onClick={() => handleShortClick(short.id)}
            />
          ))}
        </div>
      </div>

      {/* Modal for fullscreen playback */}
      {selectedShort && (
        <ShortVideoModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedShort(null);
          }}
          short={selectedShort}
          onOpenDonation={() => setIsDonationModalOpen(true)}
          onOpenComments={() => setIsCommentsOpen(true)}
          commentCount={selectedShort.commentCount || 0}
          canDelete={false}
        />
      )}
    </div>
  );
};

export default Shorts;
