import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, DollarSign, Volume2, VolumeX, ExternalLink, Play, Pause, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { useNavigate } from 'react-router-dom';
import DonationModal from '@/components/DonationModal';
import { ExpandableDescription } from '@/components/ExpandableDescription';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

interface DesktopShortPlayerProps {
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

export function DesktopShortPlayer({
  short,
  isActive,
  isMuted,
  onToggleMute,
  onRegisterVideo,
  onOpenComments,
  onOpenDonation,
  onOpenPayment,
  onShare,
}: DesktopShortPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog, setShowGuestDialog } = 
    useShortVideoLike(short.id);
  
  const { isFollowing, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = 
    useFollow(short.user_id);

  const { hasAccess, isPremium, price, isOwner, previewDuration, isLoading } = usePremiumAccess({
    contentType: 'shortvideo',
    contentId: short.id,
  });

  // Track views when active
  useVideoView(short.id, isActive);

  // Auto-play when active
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
      
      // Fetch like count when video becomes active
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

  // Controls auto-hide - show on mouse move, hide after 3s
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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

  // Sync mute state and volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted) {
        videoRef.current.volume = volume;
      }
    }
  }, [isMuted, volume]);

  const handleVideoClick = () => {
    // Toggle play/pause on click
    togglePlayPause();
    // Also show controls briefly
    setShowControls(true);
    // Unmute on first click if video is playing muted
    if (isMuted && videoRef.current && !videoRef.current.paused) {
      onToggleMute();
    }
  };

  const togglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0];
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      if (vol === 0 && !isMuted) {
        onToggleMute();
      } else if (vol > 0 && isMuted) {
        onToggleMute();
      }
    }
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFollow();
  };

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black overflow-hidden">
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
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8">
          <Lock className="h-24 w-24 text-white mb-6 animate-pulse" />
          <h2 className="text-4xl font-bold text-white text-center mb-3">
            {previewEnded ? 'Preview Ended' : 'Premium Short'}
          </h2>
          <p className="text-xl text-white/90 text-center mb-3">
            {previewEnded 
              ? `${previewDuration}-second preview ended • Unlock to watch full video` 
              : `Unlock for ${price} SOL`}
          </p>
          <p className="text-white/70 text-center mb-10 max-w-md">
            One-time payment • Permanent access • Creator gets 95%
          </p>
          <Button
            size="lg"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPayment();
            }}
            className="bg-white text-purple-900 hover:bg-white/90 font-bold text-lg px-8 py-6 h-auto"
          >
            <Lock className="h-5 w-5 mr-2" />
            Unlock This Short
          </Button>
          
          {/* Blurred preview in background */}
          <div className="absolute inset-0 -z-10">
            <video
              src={short.video_url}
              className="w-full h-full object-contain blur-3xl opacity-20"
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
          className="w-screen h-screen object-cover cursor-pointer transform-gpu will-change-transform"
          loop
          playsInline
          muted={isMuted}
          preload={isActive ? "auto" : "metadata"}
          onClick={handleVideoClick}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          aria-label="Short video player"
        />
      )}

      {/* Play/Pause Overlay - shows only when video is paused */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 cursor-pointer z-10"
          onClick={togglePlayPause}
        >
          <div className="w-20 h-20 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
            {isPlaying ? (
              <Pause className="h-10 w-10 text-white" fill="white" />
            ) : (
              <Play className="h-10 w-10 text-white ml-1" fill="white" />
            )}
          </div>
        </div>
      )}

      {/* Volume Controls - Top Right */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-30">
        {/* Volume Slider - shows when unmuted */}
        {!isMuted && (
          <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full animate-fade-in">
            <Volume2 className="h-4 w-4 text-white" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="w-24"
            />
            <span className="text-xs text-white font-medium min-w-[2.5rem] text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        )}
        
        {/* Mute/Unmute Button */}
        <Button
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="h-12 w-12 rounded-full transition-all bg-red-500/90 hover:bg-red-600 text-white shadow-lg"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Right Action Buttons - Vibrant Mobile Style */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-20">
        {/* Like */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={handleLikeClick}
            className={`h-14 w-14 rounded-full transition-all hover:scale-110 ${
              isLiked 
                ? 'bg-primary/90 hover:bg-primary scale-110' 
                : 'bg-black/60 hover:bg-black/70'
            } text-white border-2 border-white/30 shadow-2xl`}
          >
            <Heart className={`h-7 w-7 ${isLiked ? 'fill-current' : ''}`} />
          </Button>
          <span className="text-sm text-white font-bold drop-shadow-lg">
            {likeCount > 0 ? formatNumber(likeCount) : ''}
          </span>
        </div>

        {/* Comment */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments();
            }}
            className="h-14 w-14 rounded-full bg-black/60 hover:bg-black/70 text-white border-2 border-white/30 shadow-2xl transition-transform hover:scale-110"
          >
            <MessageCircle className="h-7 w-7" />
          </Button>
          <span className="text-sm text-white font-bold drop-shadow-lg">
            {short.commentCount && short.commentCount > 0 ? formatNumber(short.commentCount) : ''}
          </span>
        </div>

        {/* Share */}
        <Button
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="h-14 w-14 rounded-full bg-black/60 hover:bg-black/70 text-white border-2 border-white/30 shadow-2xl transition-transform hover:scale-110"
        >
          <Share2 className="h-7 w-7" />
        </Button>

        {/* Donate */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (!short.profiles?.public_wallet_address) {
                setShowGuestDialog(true);
              } else {
                onOpenDonation();
              }
            }}
            className="h-14 w-14 rounded-full bg-primary/90 hover:bg-primary text-white border-2 border-white/30 shadow-2xl transition-transform hover:scale-110"
          >
            <DollarSign className="h-7 w-7" />
          </Button>
          <span className="text-xs text-white font-medium drop-shadow-lg">
            Tip
          </span>
        </div>

        {/* Promotional Link */}
        {short.promotional_link && (
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              window.open(short.promotional_link!, '_blank');
            }}
            className="h-14 w-14 rounded-full bg-accent/90 hover:bg-accent text-white border-2 border-white/30 shadow-2xl transition-transform hover:scale-110"
          >
            <ExternalLink className="h-7 w-7" />
          </Button>
        )}
      </div>

      {/* Bottom Info Panel - Mobile Style with Gradient */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-6 pb-8 z-10">
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <Avatar 
            className="h-12 w-12 border-2 border-white cursor-pointer shrink-0 hover:scale-105 transition-transform" 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${short.profiles?.username}`);
            }}
          >
            <AvatarImage src={optimizeImage(short.profiles?.avatar_url, imagePresets.avatar)} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {short.profiles?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          {/* Username and Follow Button */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <a 
                href={`/profile/${short.profiles?.username}`}
                className="font-bold text-white hover:underline cursor-pointer text-base truncate"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/profile/${short.profiles?.username}`);
                }}
              >
                @{short.profiles?.username || 'unknown'}
              </a>
              
              {/* Inline Follow Button */}
              {user && user.id !== short.user_id && (
                <Button
                  size="sm"
                  variant={isFollowing ? "secondary" : "default"}
                  onClick={handleFollowClick}
                  className="h-6 px-3 text-xs font-semibold shrink-0"
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
            
            {/* Display Name */}
            {short.profiles?.display_name && (
              <p className="text-sm text-gray-300 truncate">{short.profiles.display_name}</p>
            )}
          </div>
        </div>
        
        {/* Title and Description */}
        <div className="space-y-1 text-white">
          {short.title && (
            <h3 className="font-bold text-lg leading-tight">{short.title}</h3>
          )}
          {short.description && (
            <ExpandableDescription 
              text={short.description}
              maxLines={3}
              className="text-sm text-gray-200"
            />
          )}
        </div>
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
        action="like"
      />
    </div>
  );
}
