import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Wallet, Volume2, VolumeX, ExternalLink, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';

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
  const [isHovering, setIsHovering] = useState(false);
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
      // Fetch like count when video becomes active
      if (short.like_count !== undefined) {
        setLikeCount(short.like_count);
      }
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive, isMuted, short.like_count, setLikeCount]);

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

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden py-6">
      {/* Video Player Container - Centered */}
      <div className="relative max-h-[90vh] max-w-[600px] w-full flex items-center justify-center">
        {/* Video Wrapper with Hover Detection */}
        <div 
          className="relative w-full h-full"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <video
            ref={videoRef}
            src={short.video_url}
            className="w-full h-full max-h-[90vh] object-contain cursor-pointer"
            playsInline
            loop
            preload={isActive ? "auto" : "metadata"}
            onClick={togglePlayPause}
            aria-label="Short video player"
          />

          {/* Play/Pause Overlay - Shows on hover or when paused */}
          {(isHovering || !isPlaying) && (
            <div 
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 cursor-pointer z-10"
              onClick={togglePlayPause}
            >
              <div className="w-24 h-24 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                {isPlaying ? (
                  <Pause className="h-12 w-12 text-white" fill="white" />
                ) : (
                  <Play className="h-12 w-12 text-white ml-1" fill="white" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mute/Unmute Button - Top Right of Video */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="absolute top-6 right-6 z-30 rounded-full p-3 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all shadow-lg"
        >
          {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>

        {/* Right Sidebar - Creator Info & Actions (Inside Video Container) */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 items-center w-16 z-20">
          {/* Creator Avatar */}
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-14 w-14 border-2 border-white cursor-pointer hover:scale-105 transition-transform">
              <AvatarImage src={optimizeImage(short.profiles?.avatar_url, imagePresets.avatar)} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {short.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {user && user.id !== short.user_id && !isFollowing && (
              <button
                onClick={toggleFollow}
                className="w-6 h-6 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg transition-all"
                aria-label="Follow"
              >
                <span className="text-primary-foreground text-xl font-bold leading-none">+</span>
              </button>
            )}
          </div>

          {/* Like */}
          <button
            onClick={toggleLike}
            className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
          >
            <div className={`p-3 rounded-full backdrop-blur-sm shadow-lg ${isLiked ? 'bg-white/90' : 'bg-black/60 hover:bg-black/80'}`}>
              <Heart
                className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
              />
            </div>
            <span className="text-white text-xs font-medium">
              {likeCount > 0 ? formatNumber(likeCount) : ''}
            </span>
          </button>

          {/* Comment */}
          <button
            onClick={onOpenComments}
            className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
          >
            <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm shadow-lg">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">
              {short.commentCount && short.commentCount > 0 ? formatNumber(short.commentCount) : ''}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={onShare}
            className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
          >
            <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm shadow-lg">
              <Share2 className="h-6 w-6 text-white" />
            </div>
          </button>

          {/* Promotional Link */}
          {short.promotional_link && (
            <a
              href={short.promotional_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
            >
              <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm shadow-lg">
                <ExternalLink className="h-6 w-6 text-white" />
              </div>
            </a>
          )}

          {/* Donate */}
          {short.profiles?.public_wallet_address && (
            <button
              onClick={onOpenDonation}
              className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
            >
              <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm shadow-lg">
                <Wallet className="h-6 w-6 text-white" />
              </div>
            </button>
          )}
        </div>

        {/* Bottom Info Panel */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-white font-semibold">
              @{short.profiles?.username || 'Unknown'}
            </p>
            {short.profiles?.display_name && (
              <p className="text-white/80 text-sm">{short.profiles.display_name}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-white font-bold text-lg line-clamp-2">{short.title}</h3>
            {short.description && (
              <p className="text-white/80 line-clamp-2">{short.description}</p>
            )}
          </div>
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
