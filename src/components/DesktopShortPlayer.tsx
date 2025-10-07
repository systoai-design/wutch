import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Wallet, Volume2, VolumeX, ExternalLink } from 'lucide-react';
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
    <div className="relative w-full h-screen bg-background flex items-center justify-center overflow-hidden">
      {/* Video Player - Centered */}
      <div className="relative h-full max-w-[600px] w-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={short.video_url}
          className="h-full w-full object-contain cursor-pointer"
          playsInline
          loop
          muted
          preload={isActive ? "auto" : "metadata"}
          onClick={togglePlayPause}
          aria-label="Short video player"
        />

        {/* Mute/Unmute Button - Top Right of Video */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="absolute top-4 right-4 z-30 rounded-full p-2.5 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all shadow-lg"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Right Sidebar - Creator Info & Actions */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-6 items-center w-16">
        {/* Creator Avatar */}
        <div className="flex flex-col items-center gap-2">
          <Avatar className="h-14 w-14 border-2 border-primary cursor-pointer hover:scale-105 transition-transform">
            <AvatarImage src={optimizeImage(short.profiles?.avatar_url, imagePresets.avatar)} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {short.profiles?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {user && user.id !== short.user_id && (
            <Button
              size="sm"
              variant={isFollowing ? "secondary" : "default"}
              onClick={toggleFollow}
              className="text-xs px-2 py-1 h-auto"
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>

        {/* Like */}
        <button
          onClick={toggleLike}
          className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
        >
          <div className={`p-3 rounded-full shadow-lg ${isLiked ? 'bg-primary' : 'bg-muted hover:bg-muted/80'}`}>
            <Heart
              className={`h-6 w-6 ${isLiked ? 'fill-primary-foreground text-primary-foreground' : 'text-foreground'}`}
            />
          </div>
          <span className="text-foreground text-sm font-semibold">
            {likeCount > 0 ? formatNumber(likeCount) : ''}
          </span>
        </button>

        {/* Comment */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
        >
          <div className="p-3 rounded-full bg-muted hover:bg-muted/80 shadow-lg">
            <MessageCircle className="h-6 w-6 text-foreground" />
          </div>
          <span className="text-foreground text-sm font-semibold">
            {short.commentCount && short.commentCount > 0 ? formatNumber(short.commentCount) : ''}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
        >
          <div className="p-3 rounded-full bg-muted hover:bg-muted/80 shadow-lg">
            <Share2 className="h-6 w-6 text-foreground" />
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
            <div className="p-3 rounded-full bg-accent hover:bg-accent/80 shadow-lg">
              <ExternalLink className="h-6 w-6 text-accent-foreground" />
            </div>
          </a>
        )}

        {/* Donate */}
        {short.profiles?.public_wallet_address && (
          <button
            onClick={onOpenDonation}
            className="flex flex-col items-center gap-1 hover:scale-110 active:scale-95 transition-transform"
          >
            <div className="p-3 rounded-full bg-primary hover:bg-primary/90 shadow-lg">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
          </button>
        )}
      </div>

      {/* Bottom Info Panel */}
      <div className="absolute bottom-0 left-0 right-24 p-6 bg-gradient-to-t from-background/95 via-background/70 to-transparent">
        <div className="max-w-[600px]">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-foreground font-semibold">
              @{short.profiles?.username || 'Unknown'}
            </p>
            {short.profiles?.display_name && (
              <p className="text-muted-foreground text-sm">{short.profiles.display_name}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-foreground font-bold text-lg line-clamp-2">{short.title}</h3>
            {short.description && (
              <p className="text-muted-foreground line-clamp-2">{short.description}</p>
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
