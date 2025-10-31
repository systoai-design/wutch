import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Wallet, Volume2, VolumeX, ExternalLink, Play, Pause, DollarSign, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { cn } from '@/lib/utils';
import DonationModal from '@/components/DonationModal';
import { ExpandableDescription } from '@/components/ExpandableDescription';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

interface MobileShortPlayerProps {
  short: ShortVideo;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onRegisterVideo: (id: string, el: HTMLVideoElement | null) => void;
  onOpenComments: () => void;
  onOpenDonation: () => void;
  onOpenPayment: () => void;
  onShare: () => void;
}

export function MobileShortPlayer({
  short,
  isActive,
  isMuted,
  onToggleMute,
  onRegisterVideo,
  onOpenComments,
  onOpenDonation,
  onOpenPayment,
  onShare,
}: MobileShortPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog, setShowGuestDialog } = 
    useShortVideoLike(short.id);
  
  const { isFollowing, isLoading: isFollowLoading, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = 
    useFollow(short.user_id);

  const { hasAccess, isPremium, price, isOwner, previewDuration, isLoading } = usePremiumAccess({
    contentType: 'shortvideo',
    contentId: short.id,
  });

  // Track views when active
  useVideoView(short.id, isActive);

  // Direct playback control based on isActive prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      // Only play if we have access or it's not premium or in preview mode
      if (hasAccess || !isPremium || isOwner || isPreviewMode) {
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              // Set mute state AFTER play to avoid autoplay policy issues
              video.muted = isMuted;
            })
            .catch(error => {
              console.log('[Short] Autoplay prevented:', error);
              setIsPlaying(false);
              // On first interaction anywhere, try again
              const retryOnGesture = () => {
                video.play()
                  .then(() => {
                    video.muted = isMuted;
                  })
                  .catch(e => {
                    console.log('[Short] Retry failed:', e);
                    setIsPlaying(false);
                  });
                window.removeEventListener('pointerdown', retryOnGesture);
                window.removeEventListener('touchstart', retryOnGesture);
              };
              window.addEventListener('pointerdown', retryOnGesture, { once: true });
              window.addEventListener('touchstart', retryOnGesture, { once: true });
            });
        }
      }
      
      if (short.like_count !== undefined) {
        setLikeCount(short.like_count);
      }
    } else {
      // CRITICAL: Zero volume FIRST to prevent audio bleed
      video.volume = 0;
      video.muted = true;
      video.pause();
      video.currentTime = 0;
      
      // Force stop - remove src after pausing
      video.removeAttribute('src');
      video.load();
      
      setIsPlaying(false);
    }

    return () => {
      if (video) {
        video.pause();
        video.muted = true;
      }
    };
  }, [isActive, isMuted, short.like_count, setLikeCount, hasAccess, isPremium, isOwner, isPreviewMode]);

  // Handle video loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      if (isActive) {
        video.currentTime = 0;
        video.play().catch(e => console.log('Loop play failed:', e));
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [isActive]);

  // Update isPlaying state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    // Initial sync
    setIsPlaying(!video.paused);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [hasAccess, isPreviewMode]);

  // Sync mute state and volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.volume = volume;
      }
    }
  }, [isMuted, volume]);

  // Force sync video muted state when becoming active
  useEffect(() => {
    if (videoRef.current && isActive) {
      videoRef.current.muted = isMuted;
    }
  }, [isActive, isMuted]);

  // Preview mode logic
  useEffect(() => {
    if (isPremium && !hasAccess && !isOwner && previewDuration && previewDuration > 0) {
      setIsPreviewMode(true);
      setPreviewEnded(false);
      setPreviewCountdown(previewDuration);
    } else {
      setIsPreviewMode(false);
      setPreviewEnded(false);
    }
  }, [isPremium, hasAccess, isOwner, previewDuration]);

  // Handle preview timeupdate
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPreviewMode) return;

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      setCurrentTime(current);
      
      if (previewDuration && current >= previewDuration) {
        video.pause();
        setIsPlaying(false);
        setPreviewEnded(true);
      } else if (previewDuration) {
        const remaining = Math.ceil(previewDuration - current);
        setPreviewCountdown(remaining);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isPreviewMode, previewDuration]);

  // Auto-hide controls
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleShowControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleVideoClick = () => {
    // Toggle play/pause on click
    togglePlayPause();
    // Also show controls briefly
    handleShowControls();
    // Unmute on first click if video is playing muted
    if (isMuted && videoRef.current && !videoRef.current.paused) {
      onToggleMute();
    }
  };

  const handleDoubleTap = () => {
    toggleLike();
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (newVolume === 0) {
      onToggleMute();
    } else if (isMuted) {
      onToggleMute();
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  let lastTap = 0;
  const handleTouchEnd = (e: React.TouchEvent) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 300 && tapLength > 0) {
      e.preventDefault();
      handleDoubleTap();
    } else {
      handleVideoClick();
    }
    
    lastTap = currentTime;
  };

  return (
    <div className="mobile-short-item relative w-full h-[100dvh] bg-black overflow-hidden">
      {/* Preview Badge */}
      {isPreviewMode && !previewEnded && (
        <div className="absolute top-4 left-4 z-20 bg-purple-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
          PREVIEW
        </div>
      )}

      {/* Preview Countdown */}
      {isPreviewMode && !previewEnded && isPlaying && previewCountdown > 0 && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
          Preview: {previewCountdown}s left
        </div>
      )}

      {/* Premium Paywall Overlay - Show only if preview ended or no preview */}
      {isPremium && !hasAccess && !isOwner && !isLoading && (previewEnded || !isPreviewMode) && (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <Lock className="h-20 w-20 text-white mb-6 animate-pulse" />
          <h3 className="text-2xl font-bold text-white text-center mb-2">
            {previewEnded ? 'Preview Ended' : 'Premium Short'}
          </h3>
          <p className="text-white/90 text-center mb-2">
            {previewEnded 
              ? `${previewDuration}-second preview ended` 
              : `Unlock for ${price} SOL`}
          </p>
          <p className="text-sm text-white/70 text-center mb-8 max-w-xs">
            One-time payment • Permanent access
          </p>
          <Button
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPayment();
            }}
            className="bg-white text-purple-900 hover:bg-white/90 font-bold"
          >
            <Lock className="h-4 w-4 mr-2" />
            Unlock Now
          </Button>
          
          {/* Blurred preview in background */}
          <div className="absolute inset-0 -z-10">
            <video
              src={short.video_url}
              className="w-full h-full object-cover blur-2xl opacity-30"
              muted
              loop
              playsInline
            />
          </div>
        </div>
      )}

      {/* Video - Render if has access OR in preview mode */}
      {(hasAccess || isPreviewMode) && (
        <video
          key={short.id}
          ref={(el) => {
            videoRef.current = el;
            onRegisterVideo(short.id, el);
          }}
          src={short.video_url}
          className="mobile-short-video absolute inset-0 w-full h-full object-cover"
          playsInline
          loop
          muted={isMuted}
          preload={isActive ? "auto" : "metadata"}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Tap anywhere overlay for play/pause */}
      <div 
        className="absolute inset-0 z-10"
        onPointerUp={handleVideoClick}
        onTouchEnd={handleTouchEnd}
      />

      {/* Controls Overlay - Shows on Tap */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-md transition-all duration-300 pointer-events-none z-20",
          showControls ? "opacity-100 animate-in fade-in" : "opacity-0"
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          {/* Play/Pause Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-24 w-24 rounded-full bg-black/70 hover:bg-black/80 backdrop-blur-md transition-all shadow-2xl active:scale-95"
            onClick={togglePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-12 w-12 text-white" />
            ) : (
              <Play className="h-12 w-12 text-white ml-1" />
            )}
          </Button>
        </div>

        {/* Volume Slider - Bottom Center */}
        {!isMuted && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-3 bg-black/80 backdrop-blur-sm rounded-full px-4 py-3">
              <Volume2 className="h-5 w-5 text-white shrink-0" />
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-32"
              />
              <span className="text-white text-sm font-medium min-w-[3ch]">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Overlay - Creator Info & Title */}
      <div 
        className="absolute bottom-0 left-0 right-16 p-4 z-40 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-24 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 mb-3">
          <Link 
            to={`/profile/${short.profiles?.username}`}
            className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            aria-label={`View ${short.profiles?.username}'s profile`}
          >
            <Avatar className="h-10 w-10 border-2 border-white">
              <AvatarImage src={optimizeImage(short.profiles?.avatar_url, imagePresets.avatar)} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {short.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <Link 
                to={`/profile/${short.profiles?.username}`}
                className="cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                aria-label={`View ${short.profiles?.username}'s profile`}
              >
                <span className="text-white font-semibold text-sm">
                  @{short.profiles?.username || 'Unknown'}
                </span>
              </Link>
              {user?.id !== short.user_id && (
                <Button
                  size="sm"
                  variant={isFollowing ? "secondary" : "default"}
                  onClick={toggleFollow}
                  disabled={isFollowLoading}
                  className="h-6 px-3 text-xs rounded-full bg-red-600 hover:bg-red-700 text-white shrink-0 active:scale-95 transition-transform"
                  aria-label={isFollowing ? "Unfollow creator" : "Follow creator"}
                >
                  {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                </Button>
              )}
            </div>
            {short.profiles?.display_name && (
              <p className="text-white/80 text-xs mt-0.5 truncate">{short.profiles.display_name}</p>
            )}
          </div>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-white font-semibold text-base line-clamp-2">{short.title}</h3>
          {short.description && (
            <ExpandableDescription 
              text={short.description}
              maxLines={3}
              className="text-white/90 text-sm"
            />
          )}
        </div>
      </div>

      {/* Right Side Actions - Vertically Centered */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
        {/* Mute/Unmute */}
        <button
          onClick={onToggleMute}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="p-3 rounded-full shadow-2xl backdrop-blur-sm border-2 border-white/30 bg-red-500/90 hover:bg-red-600">
            {isMuted ? (
              <VolumeX className="h-6 w-6 text-white" />
            ) : (
              <Volume2 className="h-6 w-6 text-white" />
            )}
          </div>
        </button>

        {/* Like */}
        <button
          onClick={toggleLike}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className={`p-3 rounded-full shadow-2xl backdrop-blur-sm border-2 border-white/30 ${isLiked ? 'bg-primary/90 scale-105' : 'bg-black/60'}`}>
            <Heart
              className={`h-6 w-6 ${isLiked ? 'fill-white text-white' : 'text-white'}`}
            />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {likeCount > 0 ? formatNumber(likeCount) : ''}
          </span>
        </button>

        {/* Donate */}
        <button
          onClick={() => {
            if (!short.profiles?.public_wallet_address) {
              setShowGuestDialog(true);
            } else {
              onOpenDonation();
            }
          }}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="p-3 rounded-full bg-black/60 shadow-2xl backdrop-blur-sm border-2 border-white/30">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Tip
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="p-3 rounded-full bg-black/60 hover:bg-black/70 shadow-2xl backdrop-blur-sm border-2 border-white/30">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {short.commentCount && short.commentCount > 0 ? formatNumber(short.commentCount) : ''}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="p-2.5 rounded-full bg-black/60 hover:bg-black/70 shadow-2xl backdrop-blur-sm border-2 border-white/30">
            <Share2 className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Promotional Link */}
        {short.promotional_link && (
          <a
            href={short.promotional_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className="p-2.5 rounded-full bg-accent/90 hover:bg-accent shadow-lg backdrop-blur-sm">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
          </a>
        )}

        {/* Donate */}
        {short.profiles?.public_wallet_address && (
          <button
            onClick={onOpenDonation}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className="p-2.5 rounded-full bg-primary/90 hover:bg-primary shadow-lg backdrop-blur-sm">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
          </button>
        )}
      </div>

      {/* Guest Dialogs */}
      <GuestPromptDialog
        open={showGuestDialog}
        onOpenChange={setShowGuestDialog}
        action="like"
      />
      <GuestPromptDialog
        open={showFollowGuestDialog}
        onOpenChange={setShowFollowGuestDialog}
        action="follow"
      />
    </div>
  );
}
