import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Wallet, ExternalLink, Play, Pause, Volume2, VolumeX, X, Maximize, MoreVertical, ThumbsDown, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Database } from '@/integrations/supabase/types';
import { useShortVideoLike } from '@/hooks/useShortVideoLike';
import { useFollow } from '@/hooks/useFollow';
import { useVideoView } from '@/hooks/useVideoView';
import { shareShortToTwitter } from '@/utils/shareUtils';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
import GuestPromptDialog from '@/components/GuestPromptDialog';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
};

interface ShortVideoModalProps {
  short: ShortVideo | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDonation: () => void;
  onOpenComments: () => void;
  onDelete?: () => void;
  commentCount: number;
  canDelete: boolean;
}

export function ShortVideoModal({
  short,
  isOpen,
  onClose,
  onOpenDonation,
  onOpenComments,
  onDelete,
  commentCount,
  canDelete,
}: ShortVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0); // Start muted for autoplay
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog: showLikeGuestDialog, setShowGuestDialog: setShowLikeGuestDialog } = useShortVideoLike(short?.id || '');
  const { isFollowing, isLoading: followLoading, toggleFollow, showGuestDialog: showFollowGuestDialog, setShowGuestDialog: setShowFollowGuestDialog } = useFollow(short?.user_id || '');
  
  // Track view when modal is open
  useVideoView(short?.id || '', isOpen && !!short);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    video.volume = volume / 100;

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [volume, short]);

  // Auto-play when modal opens (muted for autoplay to work)
  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(e => console.log('Autoplay prevented:', e));
    }
  }, [isOpen, short]);

  // Update like count
  useEffect(() => {
    if (short?.like_count !== undefined) {
      setLikeCount(short.like_count);
    }
  }, [short?.like_count, setLikeCount]);

  if (!short) return null;

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const handleProgressChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = () => {
    shareShortToTwitter({
      id: short.id,
      title: short.title,
      creatorName: short.profiles?.display_name || short.profiles?.username || 'Creator',
      username: short.profiles?.username,
    });
    toast({
      title: "Opening Twitter",
      description: "Share this short with your followers!",
    });
  };

  const toggleFullscreen = async () => {
    const videoContainer = videoRef.current?.parentElement;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-[95vh] p-0 bg-black border-none">
        <div 
          className="relative w-full h-full flex items-center justify-center bg-black"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onClick={togglePlayPause}
        >
          {/* Video Container - Centered */}
          <div className="relative h-full max-w-md mx-auto flex items-center">
            <video
              ref={videoRef}
              src={short.video_url}
              className="w-full h-full object-contain max-h-[95vh]"
              loop
              playsInline
              muted
            />

            {/* Play/Pause Overlay - Center (only when paused or on hover) */}
            {(!isPlaying || showControls) && (
              <div 
                className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
              >
                <div className="pointer-events-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlayPause}
                    className="rounded-full h-20 w-20 bg-black/60 hover:bg-black/70 text-white backdrop-blur-md transition-all shadow-2xl"
                  >
                    {isPlaying ? (
                      <Pause className="h-10 w-10" />
                    ) : (
                      <Play className="h-10 w-10 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Volume Control - Top Left (on hover) */}
            {showControls && (
              <div 
                className="absolute top-4 left-4 flex items-center gap-2 z-20"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVolumeChange(volume === 0 ? [100] : [0]);
                  }}
                  className="rounded-full h-12 w-12 bg-black/60 hover:bg-black/70 text-white backdrop-blur-md transition-all"
                >
                  {volume === 0 ? (
                    <VolumeX className="h-6 w-6" />
                  ) : (
                    <Volume2 className="h-6 w-6" />
                  )}
                </Button>
                
                {showVolumeSlider && (
                  <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2">
                    <Slider
                      value={[volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="w-24"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar - Bottom */}
            <div 
              className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200"
              onMouseEnter={() => setIsHoveringProgress(true)}
              onMouseLeave={() => setIsHoveringProgress(false)}
              onClick={(e) => e.stopPropagation()}
            >
              {isHoveringProgress || showControls ? (
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
                      className="w-full cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-1 bg-white/20">
                  <div 
                    className="absolute top-0 left-0 h-full bg-primary transition-all"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Vertical Action Buttons */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-30" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike();
                }}
                className={`rounded-full h-14 w-14 backdrop-blur-sm transition-colors ${
                  isLiked 
                    ? 'bg-primary/90 hover:bg-primary text-white' 
                    : 'bg-black/50 hover:bg-black/60 text-white'
                }`}
              >
                <Heart className={`h-7 w-7 ${isLiked ? 'fill-current' : ''}`} />
              </Button>
              <span className="text-sm text-white font-bold drop-shadow-lg">{likeCount}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenComments();
                }}
                className="rounded-full h-14 w-14 bg-black/50 hover:bg-black/60 text-white backdrop-blur-sm"
              >
                <MessageCircle className="h-7 w-7" />
              </Button>
              <span className="text-sm text-white font-bold drop-shadow-lg">{commentCount}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="rounded-full h-14 w-14 bg-black/50 hover:bg-black/60 text-white backdrop-blur-sm"
              >
                <Share2 className="h-7 w-7" />
              </Button>
            </div>

            {short.profiles?.public_wallet_address && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDonation();
                }}
                className="rounded-full h-14 w-14 bg-primary/90 hover:bg-primary text-white backdrop-blur-sm"
              >
                <Wallet className="h-7 w-7" />
              </Button>
            )}

            {short.promotional_link && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-14 w-14 bg-accent/90 hover:bg-accent text-white backdrop-blur-sm"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={short.promotional_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-7 w-7" />
                </a>
              </Button>
            )}

            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="rounded-full h-14 w-14 bg-destructive/90 hover:bg-destructive text-white backdrop-blur-sm"
              >
                <Trash2 className="h-7 w-7" />
              </Button>
            )}
          </div>

          {/* Bottom Left - Creator Info */}
          <div 
            className="absolute bottom-4 left-4 max-w-sm text-white z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-2">
              {short.profiles?.avatar_url && (
                <img
                  src={short.profiles.avatar_url}
                  alt={short.profiles.username || 'User'}
                  className="w-10 h-10 rounded-full border-2 border-white"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate drop-shadow-lg">
                  @{short.profiles?.username || 'anonymous'}
                </p>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow();
                }}
                disabled={followLoading}
                size="sm"
                className={`rounded-full px-5 font-semibold ${
                  isFollowing 
                    ? 'bg-white/20 text-white hover:bg-white/30' 
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {isFollowing ? 'Subscribed' : 'Subscribe'}
              </Button>
            </div>
            <h3 className="font-semibold text-base mb-1 line-clamp-2 drop-shadow-lg">{short.title}</h3>
            {short.description && (
              <p className="text-sm text-white/90 line-clamp-2 drop-shadow-lg">{short.description}</p>
            )}
          </div>
        </div>
      </DialogContent>
      
      <GuestPromptDialog
        open={showLikeGuestDialog}
        onOpenChange={setShowLikeGuestDialog}
        action="like"
      />
      
      <GuestPromptDialog
        open={showFollowGuestDialog}
        onOpenChange={setShowFollowGuestDialog}
        action="like"
      />
    </Dialog>
  );
}
