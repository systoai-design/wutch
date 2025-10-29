import { useState, useEffect, useRef, useCallback } from 'react';
import { ShortCard } from '@/components/ShortCard';
import { ShortVideoModal } from '@/components/ShortVideoModal';
import { MobileShortPlayer } from '@/components/MobileShortPlayer';
import { DesktopShortPlayer } from '@/components/DesktopShortPlayer';
import { X402PaymentModal } from '@/components/X402PaymentModal';
import ShortsHeader from '@/components/ShortsHeader';
import CommentsSection from '@/components/CommentsSection';
import DonationModal from '@/components/DonationModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useShortsQuery } from '@/hooks/useShortsQuery';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { shareShortToTwitter } from '@/utils/shareUtils';
import { generateContentUrl, parseContentUrl } from '@/utils/urlHelpers';
import { makeAbsoluteUrl } from '@/utils/appUrl';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

const Shorts = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedShort, setSelectedShort] = useState<ShortVideo | null>(null);
  const [activeShortIndex, setActiveShortIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('shorts-muted');
    return saved === null ? false : saved === 'true';
  });
  const hasInitializedRef = useRef(false);
  const isDeepLinkingRef = useRef(false);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const isScrollingRef = useRef(false);

  const { data: shorts = [], isLoading } = useShortsQuery();

  // Handle deep-linking: Check URL for specific short ID
  useEffect(() => {
    if (!shorts || shorts.length === 0 || hasInitializedRef.current) return;

    // Check for ?id=xxx or pathname-based ID
    const params = new URLSearchParams(location.search);
    const shortIdFromQuery = params.get('id');
    const shortIdFromPath = parseContentUrl(location.pathname);
    const targetShortId = shortIdFromQuery || shortIdFromPath;

    if (targetShortId) {
      const targetIndex = shorts.findIndex(s => s.id === targetShortId);
      if (targetIndex !== -1) {
        console.log('[Shorts] Deep-linking to short at index:', targetIndex);
        isDeepLinkingRef.current = true;
        setActiveShortIndex(targetIndex);
        
        // Scroll to target with longer timeout to prevent IntersectionObserver override
        const scrollTimeout = isMobile ? 100 : 100;
        setTimeout(() => {
          if (isMobile && containerRef.current) {
            const targetElement = containerRef.current.children[targetIndex] as HTMLElement;
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
          } else if (desktopScrollRef.current) {
            const targetElement = desktopScrollRef.current.children[targetIndex] as HTMLElement;
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
              // Fallback if scrollIntoView doesn't work reliably
              desktopScrollRef.current.scrollTo({ top: targetElement.offsetTop, behavior: 'auto' });
            }
          }
          
          // Reset deep-linking flag after scroll completes
          setTimeout(() => {
            isDeepLinkingRef.current = false;
          }, 500);
        }, scrollTimeout);
      }
    }

    hasInitializedRef.current = true;
  }, [shorts, location, isMobile]);

  // Force first short to be active immediately when shorts load
  useEffect(() => {
    if (shorts.length > 0 && activeShortIndex === 0 && !hasInitializedRef.current) {
      setActiveShortIndex(0);
    }
  }, [shorts.length, activeShortIndex]);

  // Reset initialization flag when location changes (for navigation from home)
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [location.pathname, location.search]);

  // Track active short with Intersection Observer (Desktop vertical scroll)
  useEffect(() => {
    if (isMobile || !desktopScrollRef.current) return;

    let observerTimeout: NodeJS.Timeout;

    const observer = new IntersectionObserver(
      (entries) => {
        // Don't update if we're deep-linking
        if (isDeepLinkingRef.current) return;
        
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            
            // Debounce to prevent rapid changes
            if (observerTimeout) {
              clearTimeout(observerTimeout);
            }
            
            observerTimeout = setTimeout(() => {
              setActiveShortIndex(index);
            }, 100);
          }
        });
      },
      {
        threshold: 0.5,
        root: desktopScrollRef.current,
      }
    );

    const shortElements = desktopScrollRef.current.querySelectorAll('.desktop-short-item');
    shortElements.forEach((el) => observer.observe(el));

    return () => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observer.disconnect();
    };
  }, [isMobile, shorts.length]);

  // Save mute preference
  useEffect(() => {
    localStorage.setItem('shorts-muted', String(isMuted));
  }, [isMuted]);

  // Track active short with Intersection Observer (Mobile only)
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    let observerTimeout: NodeJS.Timeout;

    const observer = new IntersectionObserver(
      (entries) => {
        // Don't update if we're deep-linking
        if (isDeepLinkingRef.current) return;
        
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            
            // Debounce to prevent rapid changes
            if (observerTimeout) {
              clearTimeout(observerTimeout);
            }
            
            observerTimeout = setTimeout(() => {
              setActiveShortIndex(index);
            }, 100);
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

    return () => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observer.disconnect();
    };
  }, [isMobile, shorts.length]);

  useEffect(() => {
    document.title = 'Shorts | Wutch';
  }, []);

  const handleShortClick = (shortId: string) => {
    const short = shorts.find(s => s.id === shortId);
    if (short) {
      setSelectedShort(short);
      setIsCommentsOpen(true);
    }
  };

  const scrollToShort = useCallback((direction: 'up' | 'down') => {
    if (!desktopScrollRef.current) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 50) return; // Debounce 50ms

    lastScrollTime.current = now;

    const nextIndex = direction === 'down' 
      ? Math.min(activeShortIndex + 1, shorts.length - 1)
      : Math.max(activeShortIndex - 1, 0);

    // Prevent scrolling if already at boundary
    if (nextIndex === activeShortIndex) return;

    isScrollingRef.current = true;

    const targetElement = desktopScrollRef.current.children[nextIndex] as HTMLElement;
    if (targetElement) {
      // Use scrollIntoView for reliable scrolling
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Fallback: also set scrollTop directly
      setTimeout(() => {
        if (desktopScrollRef.current) {
          desktopScrollRef.current.scrollTop = targetElement.offsetTop;
        }
      }, 10);
    }

    // Clear lock after animation completes
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 600);
  }, [activeShortIndex, shorts.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (isScrollingRef.current) return;

    if (e.deltaY > 0) {
      scrollToShort('down');
    } else if (e.deltaY < 0) {
      scrollToShort('up');
    }
  }, [scrollToShort]);

  // Keyboard navigation
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToShort('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToShort('up');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/app');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, scrollToShort, navigate]);

  const handleShare = async (short: ShortVideo) => {
    if (navigator.share) {
      try {
        const url = short.profiles?.username 
          ? makeAbsoluteUrl(generateContentUrl('shorts', { 
              id: short.id, 
              title: short.title, 
              profiles: { username: short.profiles.username } 
            }))
          : makeAbsoluteUrl(`/shorts?id=${short.id}`);
        
        await navigator.share({
          title: short.title,
          text: short.description || `Check out this short by ${short.profiles?.display_name || short.profiles?.username}`,
          url,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          // Fallback to Twitter share
          shareShortToTwitter({
            id: short.id,
            title: short.title,
            creatorName: short.profiles?.display_name || short.profiles?.username || 'Creator',
            username: short.profiles?.username,
          });
        }
      }
    } else {
      // Fallback to Twitter share
      shareShortToTwitter({
        id: short.id,
        title: short.title,
        creatorName: short.profiles?.display_name || short.profiles?.username || 'Creator',
        username: short.profiles?.username,
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
        {/* Mobile-only header */}
        <ShortsHeader />
        
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
                onOpenPayment={() => {
                  setSelectedShort(short);
                  setIsPaymentModalOpen(true);
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

  // Desktop: Fullscreen Immersive Experience
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black fixed inset-0 z-50">
      <div 
        ref={desktopScrollRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        onWheel={handleWheel}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          .desktop-scroll-container::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        {shorts.map((short, index) => (
          <div
            key={short.id}
            data-index={index}
            className="desktop-short-item h-screen snap-start snap-always"
          >
            <DesktopShortPlayer
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
              onOpenPayment={() => {
                setSelectedShort(short);
                setIsPaymentModalOpen(true);
              }}
              onShare={() => handleShare(short)}
            />
          </div>
        ))}
      </div>

      {/* Back Button - Top Left */}
      <button
        onClick={() => navigate('/app')}
        className="fixed top-6 left-6 z-50 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
        aria-label="Back to home"
      >
        <span className="text-xl">←</span>
      </button>

      {/* Fixed Navigation Arrows */}
      {activeShortIndex > 0 && (
        <button
          onClick={() => scrollToShort('up')}
          className="fixed top-1/2 left-8 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
          aria-label="Previous short"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
      
      {activeShortIndex < shorts.length - 1 && (
        <button
          onClick={() => scrollToShort('down')}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg backdrop-blur-sm"
          aria-label="Next short"
        >
          <ChevronDown className="h-6 w-6" />
        </button>
      )}

      {/* Comments Sheet for Desktop - Slides from Right */}
      {selectedShort && isCommentsOpen && (
        <Sheet open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <SheetContent side="right" className="w-[400px] sm:w-[450px] h-full p-0 flex flex-col">
            <SheetHeader className="px-4 pt-6 pb-4 border-b">
              <SheetTitle>Comments</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <CommentsSection
                contentId={selectedShort.id}
                contentType="shortvideo"
              />
            </div>
          </SheetContent>
        </Sheet>
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

      {/* Payment Modal for Premium Shorts */}
      {selectedShort && isPaymentModalOpen && (
        <X402PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          contentType="shortvideo"
          contentId={selectedShort.id}
          contentTitle={selectedShort.title}
          creatorName={selectedShort.profiles?.display_name || selectedShort.profiles?.username || 'Creator'}
          price={selectedShort.x402_price || 0}
          creatorWallet={selectedShort.profiles?.public_wallet_address || ''}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            // Refresh the short to update access
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default Shorts;
