import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Wallet, Eye } from 'lucide-react';
import DonationModal from '@/components/DonationModal';
import CommentsSection from '@/components/CommentsSection';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useVideoView } from '@/hooks/useVideoView';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { shareShortToTwitter } from '@/utils/shareUtils';
import { toast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
};

const Shorts = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
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
          profiles!short_videos_user_id_fkey(username, display_name, avatar_url, public_wallet_address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShorts(data || []);

      // Fetch comment counts for all shorts
      const counts: Record<string, number> = {};
      for (const short of (data || [])) {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', short.id)
          .eq('content_type', 'shortvideo');
        
        counts[short.id] = count || 0;
      }
      setCommentCounts(counts);
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

  // Subscribe to comment updates
  useEffect(() => {
    if (shorts.length === 0) return;

    const channel = supabase
      .channel('comment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `content_type=eq.shortvideo`,
        },
        async (payload) => {
          const contentId = (payload.new as any)?.content_id || (payload.old as any)?.content_id;
          if (contentId) {
            const { count } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('content_id', contentId)
              .eq('content_type', 'shortvideo');
            
            setCommentCounts(prev => ({ ...prev, [contentId]: count || 0 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shorts]);

  const handleDeleteShort = async () => {
    const short = shorts[currentIndex];
    if (!short) return;

    try {
      const { error } = await supabase
        .from('short_videos')
        .delete()
        .eq('id', short.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Short video deleted successfully",
      });

      // Remove from local state and navigate
      const newShorts = shorts.filter(s => s.id !== short.id);
      setShorts(newShorts);
      
      if (newShorts.length === 0) {
        window.location.href = '/';
      } else if (currentIndex >= newShorts.length) {
        setCurrentIndex(newShorts.length - 1);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete short: " + error.message,
        variant: "destructive",
      });
    }
    
    setDeleteDialogOpen(false);
  };

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
      {shorts.map((short, index) => {
        const isActive = index === currentIndex;
        const isOwner = user?.id === short.user_id;
        const canDelete = isOwner || isAdmin;
        
        return (
          <ShortVideoItem
            key={short.id}
            short={short}
            index={index}
            currentIndex={currentIndex}
            isActive={isActive}
            videoRefs={videoRefs}
            containerRef={containerRef}
            onOpenDonation={() => setIsDonationModalOpen(true)}
            onOpenComments={() => setIsCommentsOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            commentCount={commentCounts[short.id] || 0}
            canDelete={canDelete}
          />
        );
      })}

      {/* Comments Sheet */}
      {shorts[currentIndex] && (
        <>
          <Sheet open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>Comments</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100%-3rem)] mt-4">
                <CommentsSection
                  contentId={shorts[currentIndex].id}
                  contentType="shortvideo"
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Donation Modal */}
          {shorts[currentIndex].profiles?.public_wallet_address && (
            <DonationModal
              isOpen={isDonationModalOpen}
              onClose={() => setIsDonationModalOpen(false)}
              streamerName={shorts[currentIndex].profiles?.display_name || shorts[currentIndex].profiles?.username || 'Creator'}
              walletAddress={shorts[currentIndex].profiles.public_wallet_address}
              contentId={shorts[currentIndex].id}
              contentType="shortvideo"
              recipientUserId={shorts[currentIndex].user_id}
            />
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Short Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this short? This action cannot be undone.
              {shorts[currentIndex] && isAdmin && user?.id !== shorts[currentIndex].user_id && " (Admin delete)"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShort}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Separate component for each short video
function ShortVideoItem({
  short,
  index,
  currentIndex,
  isActive,
  videoRefs,
  containerRef,
  onOpenDonation,
  onOpenComments,
  onDelete,
  commentCount,
  canDelete,
}: {
  short: any;
  index: number;
  currentIndex: number;
  isActive: boolean;
  videoRefs: React.MutableRefObject<(HTMLVideoElement | null)[]>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  onOpenDonation: () => void;
  onOpenComments: () => void;
  onDelete: () => void;
  commentCount: number;
  canDelete: boolean;
}) {
  const { isLiked, likeCount, toggleLike, setLikeCount } = useShortVideoLike(short.id);
  
  // Track view when video becomes active
  useVideoView(short.id, isActive);

  // Update like count from props
  useEffect(() => {
    if (short.like_count !== undefined) {
      setLikeCount(short.like_count);
    }
  }, [short.like_count, setLikeCount]);

  const handleShare = () => {
    shareShortToTwitter({
      id: short.id,
      title: short.title,
      creatorName: short.profiles?.display_name || short.profiles?.username || 'Creator',
    });
    toast({
      title: "Opening Twitter",
      description: "Share this short with your followers!",
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] snap-start snap-always relative flex items-center justify-center bg-black">
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
        <button
          onClick={() => {
            containerRef.current?.scrollTo({
              top: index * window.innerHeight,
              behavior: 'smooth'
            });
          }}
          className={`w-1.5 h-8 rounded-full transition-all ${
            isActive ? 'bg-primary' : 'bg-muted/50'
          }`}
        />
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
                  onClick={toggleLike}
                  className={`rounded-full h-12 w-12 backdrop-blur-sm transition-colors ${
                    isLiked 
                      ? 'bg-primary/90 hover:bg-primary text-white' 
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
                </Button>
                <span className="text-xs text-white font-medium mt-1">
                  {likeCount}
                </span>
              </div>

              <div className="flex flex-col items-center">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onOpenComments}
                  className="rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
                >
                  <MessageCircle className="h-6 w-6" />
                </Button>
                <span className="text-xs text-white font-medium mt-1">{commentCount}</span>
              </div>

              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleShare}
                className="rounded-full h-12 w-12 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              >
                <Share2 className="h-6 w-6" />
              </Button>

              {short.profiles?.public_wallet_address && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 bg-primary/90 hover:bg-primary text-white backdrop-blur-sm"
                  onClick={onOpenDonation}
                >
                  <Wallet className="h-6 w-6" />
                </Button>
              )}

              <div className="flex flex-col items-center">
                <div className="rounded-full h-12 w-12 bg-white/10 text-white backdrop-blur-sm flex items-center justify-center">
                  <Eye className="h-6 w-6" />
                </div>
                <span className="text-xs text-white font-medium mt-1">
                  {short.view_count >= 1000 
                    ? `${(short.view_count / 1000).toFixed(1)}K` 
                    : short.view_count}
                </span>
              </div>

              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 bg-destructive/90 hover:bg-destructive text-white backdrop-blur-sm"
                  onClick={onDelete}
                >
                  <Trash2 className="h-6 w-6" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Shorts;
