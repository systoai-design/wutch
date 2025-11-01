import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Wallet, Volume2, VolumeX, ExternalLink, Play, Pause, DollarSign, Lock, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { useVideoView } from '@/hooks/useVideoView';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/hooks/useAuth';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useDeleteShortVideo } from '@/hooks/useDeleteShortVideo';
import { formatNumber } from '@/utils/formatters';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import type { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { cn } from '@/lib/utils';
import DonationModal from '@/components/DonationModal';
import { ExpandableDescription } from '@/components/ExpandableDescription';
import { useNavigate } from 'react-router-dom';
import { useShortsVideoController } from '@/components/ShortsVideoController';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

interface MobileShortPlayerProps {
  short: ShortVideo;
  index: number;
  activeIndex: number;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenComments: () => void;
  onOpenDonation: () => void;
  onOpenPayment: () => void;
  onShare: () => void;
}

export function MobileShortPlayer({
  short,
  index,
  activeIndex,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onOpenDonation,
  onOpenPayment,
  onShare,
}: MobileShortPlayerProps) {
  const controller = useShortsVideoController();
  const videoSlotRef = useRef<HTMLDivElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [previewCountdown, setPreviewCountdown] = useState<number>(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const touchRef = useRef({ x: 0, y: 0, t: 0 });
  const lastTapRef = useRef(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deleteShortVideo, isDeleting } = useDeleteShortVideo();
  
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

  // Register video slot with controller
  useEffect(() => {
    if (videoSlotRef.current) {
      controller.registerSlot(short.id, videoSlotRef.current, {
        mp4Url: short.video_url,
        hlsUrl: short.hls_playlist_url,
      });
    }
    return () => {
      controller.unregisterSlot(short.id);
    };
  }, [short.id, short.video_url, short.hls_playlist_url, controller]);

  // Get video element from controller when active and cache it
  useEffect(() => {
    if (!isActive) {
      activeVideoRef.current = null;
      return;
    }

    const video = controller.getVideoElement();
    if (!video) return;

    // Cache the video element
    activeVideoRef.current = video;

    // Reset preview state
    setPreviewEnded(false);
    setIsPreviewMode(false);

    // Set initial like count
    if (short.like_count !== undefined) {
      setLikeCount(short.like_count);
    }

    let playPauseDebounce: NodeJS.Timeout;
    
    const handlePlay = () => {
      clearTimeout(playPauseDebounce);
      playPauseDebounce = setTimeout(() => setIsPlaying(true), 50);
    };
    
    const handlePause = () => {
      clearTimeout(playPauseDebounce);
      playPauseDebounce = setTimeout(() => setIsPlaying(false), 50);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      clearTimeout(playPauseDebounce);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      activeVideoRef.current = null;
    };
  }, [isActive, short.id, short.like_count, setLikeCount, controller]);

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
    if (!isActive || !isPreviewMode) return;
    
    const video = controller.getVideoElement();
    if (!video) return;

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
  }, [isActive, isPreviewMode, previewDuration, controller]);

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

  const togglePlayPause = useCallback(() => {
    const video = activeVideoRef.current;
    if (!video || !isActive) {
      console.warn('[MobileShortPlayer] No active video element');
      return;
    }
    
    if (video.paused || video.ended) {
      video.play().catch(e => console.log('[MobileShortPlayer] Play failed:', e));
    } else {
      video.pause();
    }
  }, [isActive]);

  const handleVideoClick = useCallback(() => {
    togglePlayPause();
    handleShowControls();
  }, [togglePlayPause]);

  const handleDoubleTap = useCallback(() => {
    toggleLike();
  }, [toggleLike]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    const video = controller.getVideoElement();
    if (video) {
      video.volume = newVolume;
    }
    if (newVolume === 0 && !isMuted) {
      onToggleMute();
    } else if (newVolume > 0 && isMuted) {
      onToggleMute();
    }
  }, [isMuted, onToggleMute, controller]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    const dx = (touch?.clientX || 0) - touchRef.current.x;
    const dy = (touch?.clientY || 0) - touchRef.current.y;
    const moved = Math.hypot(dx, dy);
    
    // Ignore if it was a swipe (movement > 15px)
    if (moved > 15) return;
    
    const delta = now - lastTapRef.current;
    if (delta < 300 && delta > 0) {
      e.preventDefault();
      handleDoubleTap();
    } else {
      handleVideoClick();
    }
    
    lastTapRef.current = now;
  };

  const handleDelete = async () => {
    const result = await deleteShortVideo(short.id);
    if (result.success) {
      setShowDeleteDialog(false);
      navigate('/shorts');
    }
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

      {/* Video Slot - Controller manages the video element */}
      <div
        ref={videoSlotRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Touch overlay for gestures */}
      <div 
        className="absolute inset-0 z-10"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Center Play/Pause Button - Always visible when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-20">
          <Button
            size="icon"
            variant="ghost"
            className="h-24 w-24 rounded-full bg-black/70 hover:bg-black/80 backdrop-blur-md transition-all shadow-2xl active:scale-95"
            onClick={togglePlayPause}
          >
            <Play className="h-12 w-12 text-white ml-1" />
          </Button>
        </div>
      )}

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
        className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(env(safe-area-inset-bottom)+6px)] z-40 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
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
            <Link 
              to={`/profile/${short.profiles?.username}`}
              className="block cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              aria-label={`View ${short.profiles?.username}'s profile`}
            >
              <span className="text-white font-semibold text-sm block truncate">
                @{short.profiles?.username || 'Unknown'}
              </span>
            </Link>
            <p className="text-white/70 text-xs truncate leading-tight">
              {short.profiles?.display_name || short.profiles?.username || 'Unknown'}
            </p>
          </div>

          {user?.id !== short.user_id && (
            <Button
              size="sm"
              variant={isFollowing ? "secondary" : "default"}
              onClick={toggleFollow}
              disabled={isFollowLoading}
              className="shrink-0 h-8 px-3 text-xs rounded-full"
              aria-label={isFollowing ? "Unfollow creator" : "Follow creator"}
            >
              {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
            </Button>
          )}
        </div>
        
        <div className="space-y-0.5">
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{short.title}</h3>
          {short.description && (
            <ExpandableDescription 
              text={short.description}
              maxLines={2}
              className="text-white/90 text-xs leading-snug"
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
          <div className={`p-3 rounded-full shadow-2xl backdrop-blur-sm border-2 border-white/30 ${
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

        {/* Delete Button - Owner Only */}
        {isOwner && (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          >
            <div className="p-2.5 rounded-full bg-destructive/90 hover:bg-destructive shadow-lg backdrop-blur-sm">
              <Trash className="h-6 w-6 text-white" />
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Short Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this short? This action cannot be undone and you will be redirected to the shorts feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
