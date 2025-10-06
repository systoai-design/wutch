import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Wallet, ExternalLink, Play, Pause, Volume2, VolumeX, X, Maximize, MoreVertical, ThumbsDown, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import DonationModal from '@/components/DonationModal';
import CommentsSection from '@/components/CommentsSection';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useVideoView } from '@/hooks/useVideoView';
import { useAuth } from '@/hooks/useAuth';
import { useFollow } from '@/hooks/useFollow';
import { useAdmin } from '@/hooks/useAdmin';
import { shareShortToTwitter } from '@/utils/shareUtils';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ShortCard } from '@/components/ShortCard';
import { ShortVideoModal } from '@/components/ShortVideoModal';

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
  const [selectedShort, setSelectedShort] = useState<ShortVideo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const touchStartRef = useRef(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    const short = isMobile ? shorts[currentIndex] : selectedShort;
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

      // Remove from local state
      const newShorts = shorts.filter(s => s.id !== short.id);
      setShorts(newShorts);
      
      // Close modal if in desktop mode
      if (!isMobile) {
        setIsModalOpen(false);
        setSelectedShort(null);
      } else {
        // Adjust index if needed on mobile
        if (newShorts.length > 0 && currentIndex >= newShorts.length) {
          setCurrentIndex(newShorts.length - 1);
        }
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

  const handleCardClick = (short: ShortVideo) => {
    setSelectedShort(short);
    setIsModalOpen(true);
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
    <div className="relative w-full">
      {/* Desktop Grid Layout */}
      <div className="hidden md:block container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {shorts.map((short) => (
            <ShortCard
              key={short.id}
              short={short}
              commentCount={commentCounts[short.id] || 0}
              onClick={() => handleCardClick(short)}
            />
          ))}
        </div>
      </div>

      {/* Mobile Vertical Scroll Layout */}
      <div 
        ref={containerRef}
        className={`md:hidden h-[calc(100vh-4rem)] overflow-y-scroll overflow-x-hidden snap-y snap-mandatory scrollbar-hide w-full transition-all duration-300 ease-in-out ${
          isCommentsOpen ? 'pr-0' : ''
        }`}
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
            isCommentsOpen={isCommentsOpen}
          />
        );
      })}
      </div>

      {/* Mobile Comments Sheet */}
      {isMobile && shorts[currentIndex] && (
        <>
          <Sheet open={isCommentsOpen} onOpenChange={setIsCommentsOpen} modal={false}>
            <SheetContent side="bottom" className="h-[65vh] md:hidden pointer-events-auto">
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

          {/* Mobile Donation Modal */}
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

      {/* Desktop Modal & Comments Sidebar */}
      {!isMobile && selectedShort && (
        <>
          <ShortVideoModal
            short={selectedShort}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedShort(null);
            }}
            onOpenDonation={() => setIsDonationModalOpen(true)}
            onOpenComments={() => setIsCommentsOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            commentCount={commentCounts[selectedShort.id] || 0}
            canDelete={user?.id === selectedShort.user_id || isAdmin}
          />

          {/* Desktop Comments Sidebar */}
          <div 
            className={`fixed right-0 top-16 bottom-0 w-[400px] bg-background border-l shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
              isCommentsOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Comments</h2>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsCommentsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="h-[calc(100%-64px)]">
              <CommentsSection
                contentId={selectedShort.id}
                contentType="shortvideo"
              />
            </div>
          </div>

          {/* Desktop Donation Modal */}
          {selectedShort.profiles?.public_wallet_address && (
            <DonationModal
              isOpen={isDonationModalOpen}
              onClose={() => setIsDonationModalOpen(false)}
              streamerName={selectedShort.profiles?.display_name || selectedShort.profiles?.username || 'Creator'}
              walletAddress={selectedShort.profiles.public_wallet_address}
              contentId={selectedShort.id}
              contentType="shortvideo"
              recipientUserId={selectedShort.user_id}
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
              {((isMobile && shorts[currentIndex] && isAdmin && user?.id !== shorts[currentIndex].user_id) ||
                (!isMobile && selectedShort && isAdmin && user?.id !== selectedShort.user_id)) && " (Admin delete)"}
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
  isCommentsOpen,
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
  isCommentsOpen?: boolean;
}) {
  const { isLiked, likeCount, toggleLike, setLikeCount } = useShortVideoLike(short.id);
  const { isFollowing, isLoading: followLoading, toggleFollow } = useFollow(short.user_id);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Track view when video becomes active
  useVideoView(short.id, isActive);

  // Video event listeners for time tracking and play state
  useEffect(() => {
    const video = videoRefs.current[index];
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Set initial volume
    video.volume = volume / 100;

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [index, volume]);

  const togglePlayPause = () => {
    const video = videoRefs.current[index];
    if (!video) return;
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    const video = videoRefs.current[index];
    if (video) {
      video.volume = newVolume / 100;
    }
  };

  const handleProgressChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    const video = videoRefs.current[index];
    if (video) {
      video.currentTime = newTime;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const toggleFullscreen = async () => {
    const videoContainer = videoRefs.current[index]?.parentElement;
    if (!videoContainer) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainer.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      className={`snap-start snap-always relative flex items-center justify-center bg-black overflow-hidden transition-all duration-300 ease-in-out ${
        isCommentsOpen ? 'h-[35vh] md:h-[calc(100vh-4rem)]' : 'h-[calc(100vh-4rem)]'
      }`}
    >
      {/* Video Container with Controls Inside */}
      <div className="relative w-full h-full max-w-md mx-auto">
        <video
          ref={el => videoRefs.current[index] = el}
          src={short.video_url}
          className="w-full h-full object-contain"
          loop
          playsInline
          preload={Math.abs(index - currentIndex) <= 1 ? 'auto' : 'none'}
        />

        {/* Fullscreen & Menu - Top Right */}
        <div className="hidden md:flex absolute top-4 right-4 items-start gap-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="rounded-full h-10 w-10 bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all"
          >
            <Maximize className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Controls - Top Left */}
        <div className="absolute top-4 left-4 flex items-start gap-2 z-20">
          {/* Play/Pause Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPause}
            className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-0.5" />
            )}
          </Button>

          {/* Volume Control */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleVolumeChange(volume === 0 ? [100] : [0])}
              className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all shadow-lg"
            >
              {volume === 0 ? (
                <VolumeX className="h-7 w-7" />
              ) : (
                <Volume2 className="h-7 w-7" />
              )}
            </Button>
            
            {/* Volume Slider - Reveals on Hover */}
            <div 
              className={`absolute left-16 top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out ${
                showVolumeSlider ? 'opacity-100 w-28' : 'opacity-0 w-0 pointer-events-none'
              }`}
            >
              <div className="bg-white/30 backdrop-blur-md rounded-full px-4 py-2 shadow-lg">
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar - Bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200"
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
        >
          {isHoveringProgress ? (
            /* Expanded Progress Bar with Time Display */
            <div className="bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-4">
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between text-white text-xs mb-2 font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <Slider
                  value={[currentTime]}
                  onValueChange={handleProgressChange}
                  max={duration || 100}
                  step={0.1}
                  className="w-full [&_.bg-primary]:bg-red-500 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            /* Thin Progress Line */
            <div className="relative w-full h-0.5 bg-white/30">
              <div 
                className="absolute top-0 left-0 h-full bg-red-500 transition-all"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      </div>

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
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
        <div className="max-w-md mx-auto">
          <div className="flex items-end justify-between gap-4">
            {/* Creator Info */}
            <div className="flex-1 text-white">
              <div className="flex items-center gap-3 mb-3 bg-black/60 backdrop-blur-md rounded-2xl p-3 md:p-4">
                {short.profiles?.avatar_url && (
                  <img
                    src={short.profiles.avatar_url}
                    alt={short.profiles.username || 'User'}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base md:text-lg truncate">
                    {short.profiles?.display_name || short.profiles?.username || 'Anonymous'}
                  </p>
                  <p className="text-sm text-white/70 truncate">
                    @{short.profiles?.username || 'anonymous'}
                  </p>
                </div>
                <Button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  className={`rounded-full px-4 md:px-6 font-semibold ${
                    isFollowing 
                      ? 'bg-white/20 text-white border-white/40 hover:bg-white/30' 
                      : 'bg-white text-black hover:bg-white/90'
                  }`}
                >
                  {isFollowing ? 'Subscribed' : 'Subscribe'}
                </Button>
              </div>
              <h3 className="font-medium text-base mb-1 line-clamp-2">{short.title}</h3>
              {short.description && (
                <p className="text-sm text-white/80 line-clamp-2">{short.description}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 md:gap-5 items-center">
              {/* Like Button */}
              <div className="flex flex-col items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleLike}
                  className={`rounded-full h-12 w-12 md:h-14 md:w-14 backdrop-blur-sm transition-colors ${
                    isLiked 
                      ? 'bg-primary/90 hover:bg-primary text-white' 
                      : 'bg-black/40 hover:bg-black/60 text-white'
                  }`}
                >
                  <Heart className={`h-6 w-6 md:h-7 md:w-7 ${isLiked ? 'fill-current' : ''}`} />
                </Button>
                <span className="text-xs md:text-sm text-white font-medium">
                  {likeCount}
                </span>
                <span className="hidden md:block text-xs text-white/80">Like</span>
              </div>

              {/* Dislike Button */}
              <div className="hidden md:flex flex-col items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="rounded-full h-14 w-14 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
                >
                  <ThumbsDown className="h-7 w-7" />
                </Button>
                <span className="text-xs text-white/80">Dislike</span>
              </div>

              {/* Comment Button */}
              <div className="flex flex-col items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onOpenComments}
                  className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
                >
                  <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
                </Button>
                <span className="text-xs md:text-sm text-white font-medium">{commentCount}</span>
                <span className="hidden md:block text-xs text-white/80">Comment</span>
              </div>

              {/* Share Button */}
              <div className="flex flex-col items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleShare}
                  className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm"
                >
                  <Share2 className="h-6 w-6 md:h-7 md:w-7" />
                </Button>
                <span className="hidden md:block text-xs text-white/80">Share</span>
              </div>

              {/* Donate Button */}
              {short.profiles?.public_wallet_address && (
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-primary/90 hover:bg-primary text-white backdrop-blur-sm"
                    onClick={onOpenDonation}
                  >
                    <Wallet className="h-6 w-6 md:h-7 md:w-7" />
                  </Button>
                  <span className="hidden md:block text-xs text-white/80">Donate</span>
                </div>
              )}

              {/* External Link Button */}
              {short.promotional_link && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-accent/90 hover:bg-accent text-white backdrop-blur-sm"
                  asChild
                >
                  <a href={short.promotional_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-6 w-6 md:h-7 md:w-7" />
                  </a>
                </Button>
              )}

              {/* Delete Button */}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 md:h-14 md:w-14 bg-destructive/90 hover:bg-destructive text-white backdrop-blur-sm"
                  onClick={onDelete}
                >
                  <Trash2 className="h-6 w-6 md:h-7 md:w-7" />
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
