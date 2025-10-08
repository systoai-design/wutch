import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Wallet, Volume2, VolumeX, ExternalLink, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAutoPlayShort } from '@/hooks/useAutoPlayShort';
import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { cn } from '@/lib/utils';

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
  onOpenComments: () => void;
  onOpenDonation: () => void;
  onShare: () => void;
}

export function MobileShortPlayer({
  short,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onOpenDonation,
  onShare,
}: MobileShortPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog, setShowGuestDialog } = 
    useShortVideoLike(short.id);
  
  const { isFollowing, isLoading: isFollowLoading, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = 
    useFollow(short.user_id);

  // Track views when active
  useVideoView(short.id, isActive);

  // Auto-play management
  useAutoPlayShort({
    videoRef,
    shortId: short.id,
    isActive,
    isMuted,
    onBecomeActive: () => {
      // Fetch like count when video becomes active
      if (short.like_count !== undefined) {
        setLikeCount(short.like_count);
      }
    }
  });

  // Update isPlaying state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

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
    handleShowControls();
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
      {/* Video */}
      <video
        ref={videoRef}
        src={short.video_url}
        className="mobile-short-video absolute inset-0 w-full h-full object-contain"
        playsInline
        loop
        preload={isActive ? "auto" : "none"}
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
        className="absolute bottom-0 left-0 right-16 p-4 z-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pointer-events-auto"
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
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1">
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
                  className="h-5 px-2 text-[11px] leading-none rounded-sm ml-1 shrink-0 active:scale-95 transition-transform"
                  aria-label={isFollowing ? "Unfollow creator" : "Follow creator"}
                >
                  {isFollowLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow')}
                </Button>
              )}
            </div>
            {short.profiles?.display_name && (
              <p className="text-white/80 text-xs truncate">{short.profiles.display_name}</p>
            )}
          </div>
        </div>
        
        <div className="space-y-1">
          <h3 className="text-white font-semibold text-base line-clamp-2">{short.title}</h3>
          {short.description && (
            <p className="text-white/90 text-sm line-clamp-3">{short.description}</p>
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
          <div className={`p-2.5 rounded-full shadow-lg backdrop-blur-sm ${
            isMuted ? 'bg-red-500/90' : 'bg-green-500/90'
          }`}>
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
          <div className={`p-2.5 rounded-full shadow-lg backdrop-blur-sm ${isLiked ? 'bg-primary/90 scale-105' : 'bg-black/50'}`}>
            <Heart
              className={`h-6 w-6 ${isLiked ? 'fill-white text-white' : 'text-white'}`}
            />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {likeCount > 0 ? formatNumber(likeCount) : ''}
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="p-2.5 rounded-full bg-black/50 hover:bg-black/60 shadow-lg backdrop-blur-sm">
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
          <div className="p-2.5 rounded-full bg-black/50 hover:bg-black/60 shadow-lg backdrop-blur-sm">
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
