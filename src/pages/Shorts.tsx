import { useState, useEffect, useRef, useCallback } from 'react';
import { ShortCard } from '@/components/ShortCard';
import { ShortVideoModal } from '@/components/ShortVideoModal';
import { MobileShortPlayer } from '@/components/MobileShortPlayer';
import CommentsSection from '@/components/CommentsSection';
import DonationModal from '@/components/DonationModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { useShortsQuery } from '@/hooks/useShortsQuery';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

const Shorts = () => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedShort, setSelectedShort] = useState<ShortVideo | null>(null);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('shorts-muted');
    return saved === null ? true : saved === 'true';
  });

  const { data: shorts = [], isLoading } = useShortsQuery();

  // Save mute preference
  useEffect(() => {
    localStorage.setItem('shorts-muted', String(isMuted));
  }, [isMuted]);

  // Track active short with Intersection Observer (Mobile only)
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setActiveShortIndex(index);
          }
        });
      },
      {
        threshold: 0.5,
        root: containerRef.current,
      }
    );

    const shortElements = containerRef.current.querySelectorAll('.mobile-short-item');
    shortElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isMobile, shorts.length]);

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

  const handleShare = (short: ShortVideo) => {
    const shareUrl = `${window.location.origin}/shorts?id=${short.id}`;
    const shareText = `Check out this short: ${short.title}`;
    
    if (navigator.share) {
      navigator.share({
        title: short.title,
        text: shareText,
        url: shareUrl,
      }).catch(() => {
        // User cancelled or error
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share link copied to clipboard',
      });
    }
  };

  if (isLoading) {
    if (isMobile) {
      return (
        <div className="h-[100dvh] bg-black flex items-center justify-center">
          <div className="relative w-full h-full">
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-lg">Loading shorts...</div>
            </div>
          </div>
        </div>
      );
    }
    return (
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
    );
  }

  if (shorts.length === 0) {
    return (
      <div className={`${isMobile ? 'h-[100dvh]' : 'min-h-screen pb-20 lg:pb-6'} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No shorts available</p>
          <p className="text-sm text-muted-foreground mt-2">Be the first to upload!</p>
        </div>
      </div>
    );
  }

  // Mobile: Vertical scroll with snap
  if (isMobile) {
    return (
      <>
        <div 
          ref={containerRef}
          className="mobile-shorts-container h-[100dvh] overflow-y-scroll snap-y snap-mandatory"
        >
          {shorts.map((short, index) => (
            <div
              key={short.id}
              data-index={index}
              className="mobile-short-item"
            >
              <MobileShortPlayer
                short={short}
                isActive={index === activeShortIndex}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                onOpenComments={() => {
                  setSelectedShort(short);
                  setIsCommentsOpen(true);
                }}
                onOpenDonation={() => {
                  setSelectedShort(short);
                  setIsDonationModalOpen(true);
                }}
                onShare={() => handleShare(short)}
              />
            </div>
          ))}
        </div>

        {/* Comments Drawer - Slides up from bottom */}
        {selectedShort && (
          <Drawer open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <DrawerContent className="max-h-[85vh]">
              <div className="p-4">
                <CommentsSection
                  contentId={selectedShort.id}
                  contentType="shortvideo"
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}

        {/* Donation Modal */}
        {selectedShort && selectedShort.profiles?.public_wallet_address && (
          <DonationModal
            isOpen={isDonationModalOpen}
            onClose={() => setIsDonationModalOpen(false)}
            streamerName={selectedShort.profiles.username || 'creator'}
            walletAddress={selectedShort.profiles.public_wallet_address}
            contentId={selectedShort.id}
            contentType="shortvideo"
            recipientUserId={selectedShort.user_id}
          />
        )}
      </>
    );
  }

  // Desktop: Grid layout
  return (
    <div className="p-4 pb-20 lg:pb-6">
      <h1 className="text-3xl font-bold mb-6">Shorts</h1>
      
      {/* Grid layout for desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
        {shorts.map((short) => (
          <ShortCard 
            key={short.id} 
            short={short} 
            commentCount={short.commentCount}
            onClick={() => handleShortClick(short.id)}
          />
        ))}
      </div>

      {/* Modal for fullscreen playback */}
      {selectedShort && (
        <>
          <ShortVideoModal
            isOpen={isModalOpen && !isCommentsOpen}
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

          {/* Comments Side Panel for Desktop */}
          {isCommentsOpen && (
            <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
              <DialogContent className="max-w-md h-[90vh] p-0">
                <div className="h-full overflow-y-auto p-4">
                  <CommentsSection
                    contentId={selectedShort.id}
                    contentType="shortvideo"
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Donation Modal */}
          {selectedShort.profiles?.public_wallet_address && (
            <DonationModal
              isOpen={isDonationModalOpen}
              onClose={() => setIsDonationModalOpen(false)}
              streamerName={selectedShort.profiles.username || 'creator'}
              walletAddress={selectedShort.profiles.public_wallet_address}
              contentId={selectedShort.id}
              contentType="shortvideo"
              recipientUserId={selectedShort.user_id}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Shorts;
