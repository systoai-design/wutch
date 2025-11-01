import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Volume1, Play, Pause, ExternalLink, Wallet, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteShortVideo } from "@/hooks/useDeleteShortVideo";
import { useShortVideoLike } from "@/hooks/useShortVideoLike";
import { useFollow } from "@/hooks/useFollow";
import { useVideoView } from "@/hooks/useVideoView";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { formatNumber } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";
import GuestPromptDialog from "./GuestPromptDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Database } from "@/integrations/supabase/types";
import { Lock } from "lucide-react";

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
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [volume, setVolume] = useState(1);
  const lastTapTime = useRef(0);
  const { toast } = useToast();
  
  // Hooks
  const { deleteShortVideo, isDeleting } = useDeleteShortVideo();
  const { isLiked, likeCount, toggleLike, showGuestDialog, setShowGuestDialog } = useShortVideoLike(short.id);
  const { isFollowing, isLoading: isFollowLoading, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = useFollow(short.user_id);
  const { hasAccess } = usePremiumAccess({
    contentType: 'shortvideo',
    contentId: short.id,
  });
  
  // Track view
  useVideoView(short.id, isActive);

  // Video playback state sync
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

  // Activation logic - force stop all other videos, then play this one
  useEffect(() => {
    if (!isActive || !videoRef.current) {
      // Deactivate: pause and reset
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      return;
    }

    // Emergency brake: Force-stop ALL other videos in DOM
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(v => {
      if (v !== videoRef.current) {
        v.pause();
        v.muted = true;
        v.currentTime = 0;
      }
    });

    // Sync mute state for THIS video before playing
    videoRef.current.muted = isMuted;

    // Play this video
    const playPromise = videoRef.current.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.log('[MobileShortPlayer] Autoplay prevented:', err);
      });
    }

    return () => {
      // Cleanup on deactivation
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
  }, [isActive, isMuted]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Auto-hide controls when playing
  useEffect(() => {
    if (!isPlaying || !showControls) return;
    
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current || !isActive) return;

    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => {
        console.log('[MobileShortPlayer] Play failed:', err);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  // Touch handling - single tap = play/pause, double tap = like
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const delta = now - lastTapTime.current;

    if (delta < 300) {
      // Double tap - like
      e.preventDefault();
      toggleLike();
    } else {
      // Single tap - play/pause + show controls
      togglePlayPause();
      setShowControls(true);
    }

    lastTapTime.current = now;
  };

  // Delete handler
  const handleDelete = async () => {
    const result = await deleteShortVideo(short.id);
    if (result.success) {
      setShowDeleteDialog(false);
    }
  };

  const isOwner = user?.id === short.user_id;
  const showPreviewOverlay = false; // Premium feature removed for simplicity

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={short.video_url}
        className="absolute inset-0 w-full h-full object-contain"
        playsInline
        loop
        preload="metadata"
      />

      {/* Premium Paywall Overlay */}
      {showPreviewOverlay && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-40">
          <div className="text-center px-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Premium Content</h3>
            <p className="text-white/80 text-sm mb-6">
              Unlock this video
            </p>
            <Button
              onClick={onOpenDonation}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              Unlock Now
            </Button>
          </div>
        </div>
      )}

      {/* Touch overlay for gesture detection */}
      <div
        className="absolute inset-0 z-10"
        onTouchEnd={handleTouchEnd}
        onClick={togglePlayPause}
      />

      {/* Play/Pause Button - Center (shows when paused or controls visible) */}
      {(!isPlaying || showControls) && !showPreviewOverlay && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <button
            onClick={togglePlayPause}
            className="h-20 w-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <Pause className="h-10 w-10 text-white" />
            ) : (
              <Play className="h-10 w-10 text-white ml-1" />
            )}
          </button>
        </div>
      )}

      {/* Bottom Info Section */}
      <div className="absolute bottom-0 left-0 right-16 p-4 z-20">
        {/* Creator Info */}
        <div className="flex items-center gap-3 mb-2">
          <Link 
            to={`/profile/${short.profiles?.username}`}
            className="shrink-0"
          >
            <Avatar className="h-10 w-10 border-2 border-white">
              <AvatarImage src={short.profiles?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {short.profiles?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Link 
              to={`/profile/${short.profiles?.username}`}
              className="block min-w-0"
            >
              <p className="text-white font-semibold text-sm truncate leading-tight">
                @{short.profiles?.username || 'Unknown'}
              </p>
            </Link>

            {user?.id !== short.user_id && (
              <Button
                size="sm"
                variant={isFollowing ? "secondary" : "default"}
                onClick={toggleFollow}
                disabled={isFollowLoading}
                className="shrink-0 h-7 px-3 text-xs rounded-full ml-auto"
              >
                {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-white text-sm font-medium line-clamp-2 mb-1 leading-tight">
          {short.title}
        </h3>

        {/* Description */}
          {short.description && (
            <div className="space-y-1">
              <p className={`text-white/80 text-xs leading-tight ${
                isDescriptionExpanded ? '' : 'line-clamp-3'
              }`}>
                {short.description}
                {!isDescriptionExpanded && short.description.length > 100 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDescriptionExpanded(true);
                    }}
                    className="ml-1 text-white/90 font-medium"
                  >
                    ...more
                  </button>
                )}
              </p>
              {isDescriptionExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDescriptionExpanded(false);
                  }}
                  className="text-white/90 text-xs font-medium"
                >
                  Show less
                </button>
              )}
            </div>
          )}
      </div>

      {/* Right Action Bar */}
      <div className="absolute right-3 bottom-20 z-20 flex flex-col gap-4">
        {/* Volume Control */}
        <div className="relative flex flex-col items-center gap-1">
          {/* Volume Slider Popup */}
          {showVolumeControl && (
            <div 
              className="absolute bottom-full mb-2 bg-black/90 backdrop-blur-sm rounded-full p-3 flex flex-col items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(e) => {
                  const newVolume = parseInt(e.target.value) / 100;
                  setVolume(newVolume);
                  if (videoRef.current) {
                    videoRef.current.volume = newVolume;
                    if (newVolume === 0) {
                      videoRef.current.muted = true;
                    } else if (isMuted) {
                      videoRef.current.muted = false;
                      onToggleMute();
                    }
                  }
                }}
                className="h-24 w-1 accent-white cursor-pointer"
                style={{
                  WebkitAppearance: 'slider-vertical',
                } as React.CSSProperties}
              />
              <span className="text-white text-xs font-medium">
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
          
          {/* Volume Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowVolumeControl(!showVolumeControl);
              setTimeout(() => setShowVolumeControl(false), 3000);
            }}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              {volume === 0 || isMuted ? (
                <VolumeX className="h-6 w-6 text-white" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-6 w-6 text-white" />
              ) : (
                <Volume2 className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
        </div>

        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLike();
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <Heart
              className={`h-6 w-6 transition-colors ${
                isLiked ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </div>
          <span className="text-xs text-white font-medium">{formatNumber(likeCount)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments();
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{short.commentCount || 0}</span>
        </button>

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <Share2 className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Promotional Links */}
        {short.promotional_link && (
          <a
            href={short.promotional_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
          </a>
        )}

        {/* Donate/Wallet - Always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (short.profiles?.public_wallet_address) {
              onOpenDonation();
            } else {
              toast({
                title: "Wallet not configured",
                description: "This creator hasn't set up their wallet for donations yet.",
              });
            }
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
            <Wallet className="h-6 w-6 text-white" />
          </div>
        </button>

        {/* Delete (owner only) */}
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            className="flex flex-col items-center gap-1"
          >
            <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform">
              <Trash2 className="h-6 w-6 text-white" />
            </div>
          </button>
        )}
      </div>

      {/* Guest Prompt Dialogs */}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Short Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this short? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
