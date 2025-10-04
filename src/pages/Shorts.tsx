import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Wallet } from 'lucide-react';
import DonationModal from '@/components/DonationModal';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'wallet_address'>;
};

const Shorts = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const touchStartRef = useRef(0);

  useEffect(() => {
    document.title = 'Shorts - Quick Videos | Wutch';
    fetchShorts();
  }, []);

  const fetchShorts = async () => {
    try {
      const { data, error } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey(username, display_name, avatar_url, wallet_address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShorts(data || []);
    } catch (error) {
      console.error('Error fetching shorts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (shorts.length === 0) return;

    // Play current video, pause others
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === currentIndex) {
          video.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
          video.pause();
        }
      }
    });
  }, [currentIndex, shorts.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      if (isScrollingRef.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const windowHeight = window.innerHeight;
        const newIndex = Math.round(scrollTop / windowHeight);
        
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < shorts.length) {
          setCurrentIndex(newIndex);
        }
      }, 150);
    };

    const handleWheel = (e: WheelEvent) => {
      if (isScrollingRef.current) return;
      
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      navigateShort(direction);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEnd = e.changedTouches[0].clientY;
      const diff = touchStartRef.current - touchEnd;
      
      if (Math.abs(diff) > 50) {
        const direction = diff > 0 ? 1 : -1;
        navigateShort(direction);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateShort(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateShort(-1);
      } else if (e.key === ' ') {
        e.preventDefault();
        const currentVideo = videoRefs.current[currentIndex];
        if (currentVideo) {
          currentVideo.paused ? currentVideo.play() : currentVideo.pause();
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(scrollTimeout);
    };
  }, [currentIndex, shorts.length]);

  const navigateShort = (direction: number) => {
    if (isScrollingRef.current) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < shorts.length) {
      isScrollingRef.current = true;
      setCurrentIndex(newIndex);
      
      const container = containerRef.current;
      if (container) {
        container.scrollTo({
          top: newIndex * window.innerHeight,
          behavior: 'smooth'
        });
      }
      
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 700);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No shorts available yet</p>
          <Button onClick={() => window.location.href = '/submit'}>Upload First Short</Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-[calc(100vh-4rem)] overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ scrollBehavior: 'smooth' }}
    >
      {shorts.map((short, index) => (
        <div 
          key={short.id}
          className="h-[calc(100vh-4rem)] snap-start snap-always relative flex items-center justify-center bg-black"
        >
          {/* Video */}
          <video
            ref={el => videoRefs.current[index] = el}
            src={short.video_url}
            className="w-full h-full object-contain max-w-md mx-auto"
            loop
            playsInline
            preload={Math.abs(index - currentIndex) <= 1 ? 'auto' : 'none'}
          />

          {/* Navigation Indicators - Right Side */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
            {shorts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  containerRef.current?.scrollTo({
                    top: idx * window.innerHeight,
                    behavior: 'smooth'
                  });
                }}
                className={`w-1.5 h-8 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-primary' : 'bg-muted/50'
                }`}
              />
            ))}
          </div>

          {/* Bottom Overlay - Info & Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
            <div className="max-w-md mx-auto">
              <div className="flex items-end justify-between gap-4">
                {/* Creator Info */}
                <div className="flex-1 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    {short.profiles?.avatar_url && (
                      <img
                        src={short.profiles.avatar_url}
                        alt={short.profiles.username || 'User'}
                        className="w-10 h-10 rounded-full border-2 border-white"
                      />
                    )}
                    <div>
                      <p className="font-semibold">
                        {short.profiles?.display_name || short.profiles?.username || 'Anonymous'}
                      </p>
                    </div>
                  </div>
                  <h3 className="font-medium text-base mb-1 line-clamp-2">{short.title}</h3>
                  {short.description && (
                    <p className="text-sm text-white/80 line-clamp-2">{short.description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 items-center">
                  <div className="flex flex-col items-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
                    >
                      <Heart className="h-6 w-6" />
                    </Button>
                    <span className="text-xs text-white font-medium mt-1">
                      {short.like_count || 0}
                    </span>
                  </div>

                  <div className="flex flex-col items-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
                    >
                      <MessageCircle className="h-6 w-6" />
                    </Button>
                    <span className="text-xs text-white font-medium mt-1">0</span>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
                  >
                    <Share2 className="h-6 w-6" />
                  </Button>

                  {short.profiles?.wallet_address && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-12 w-12 bg-primary/90 hover:bg-primary text-white backdrop-blur-sm"
                      onClick={() => setIsDonationModalOpen(true)}
                    >
                      <Wallet className="h-6 w-6" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Donation Modal */}
          {index === currentIndex && short.profiles?.wallet_address && (
            <DonationModal
              isOpen={isDonationModalOpen}
              onClose={() => setIsDonationModalOpen(false)}
              streamerName={short.profiles?.display_name || short.profiles?.username || 'Creator'}
              walletAddress={short.profiles.wallet_address}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default Shorts;
