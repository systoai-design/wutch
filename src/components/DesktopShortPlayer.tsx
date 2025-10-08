import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, DollarSign, Volume2, VolumeX, ExternalLink, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { useNavigate } from 'react-router-dom';

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
  onOpenComments: () => void;
  onOpenDonation: () => void;
  onShare: () => void;
}

export function DesktopShortPlayer({
  short,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onOpenDonation,
  onShare,
}: DesktopShortPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog, setShowGuestDialog } = 
    useShortVideoLike(short.id);
  
  const { isFollowing, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = 
    useFollow(short.user_id);

  // Track views when active
  useVideoView(short.id, isActive);

  // Auto-play when active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      video.play().catch(error => console.log('Autoplay prevented:', error));
      setIsPlaying(true);
      // Fetch like count when video becomes active
      if (short.like_count !== undefined) {
        setLikeCount(short.like_count);
      }
    } else {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, isMuted, short.like_count, setLikeCount]);

  // Controls auto-hide
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls]);

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

  const handleVideoClick = () => {
    setShowControls(true);
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
      {/* Video */}
      <video
        ref={videoRef}
        src={short.video_url}
        className="w-full h-full object-contain cursor-pointer"
        loop
        playsInline
        preload={isActive ? "auto" : "metadata"}
        onClick={handleVideoClick}
        aria-label="Short video player"
      />

      {/* Play/Pause Overlay - shows when controls are visible or video is paused */}
      {(showControls || !isPlaying) && (
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
          className={`h-12 w-12 rounded-full transition-all ${
            isMuted 
              ? 'bg-red-500/90 hover:bg-red-600' 
              : 'bg-green-500/90 hover:bg-green-600'
          } text-white shadow-lg`}
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
            className={`h-14 w-14 rounded-full transition-all ${
              isLiked 
                ? 'bg-primary/90 hover:bg-primary scale-110' 
                : 'bg-black/50 hover:bg-black/70'
            } text-white border-2 border-white/20 shadow-lg`}
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
            className="h-14 w-14 rounded-full bg-black/50 hover:bg-black/70 text-white border-2 border-white/20 shadow-lg"
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
          className="h-14 w-14 rounded-full bg-black/50 hover:bg-black/70 text-white border-2 border-white/20 shadow-lg"
        >
          <Share2 className="h-7 w-7" />
        </Button>

        {/* Donate */}
        {short.profiles?.public_wallet_address && (
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDonation();
            }}
            className="h-14 w-14 rounded-full bg-primary/90 hover:bg-primary text-white border-2 border-white/20 shadow-lg"
          >
            <DollarSign className="h-7 w-7" />
          </Button>
        )}

        {/* Promotional Link */}
        {short.promotional_link && (
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              window.open(short.promotional_link!, '_blank');
            }}
            className="h-14 w-14 rounded-full bg-accent/90 hover:bg-accent text-white border-2 border-white/20 shadow-lg"
          >
            <ExternalLink className="h-7 w-7" />
          </Button>
        )}
      </div>

      {/* Bottom Info Panel - Mobile Style with Gradient */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pb-8 z-10">
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
            <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">
              {short.description}
            </p>
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
