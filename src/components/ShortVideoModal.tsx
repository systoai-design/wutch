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
  const [volume, setVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const { isLiked, likeCount, toggleLike, setLikeCount } = useShortVideoLike(short?.id || '');
  const { isFollowing, isLoading: followLoading, toggleFollow } = useFollow(short?.user_id || '');
  
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

  // Auto-play when modal opens
  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
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
      <DialogContent className="max-w-[95vw] md:max-w-2xl h-[95vh] md:h-auto p-0 bg-black border-none">
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {/* Video Container */}
          <div className="relative w-full h-full max-w-md mx-auto">
            <video
              ref={videoRef}
              src={short.video_url}
              className="w-full h-full object-contain"
              loop
              playsInline
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

            {/* Progress Bar */}
            <div 
              className="absolute bottom-0 left-0 right-0 z-20 transition-all duration-200"
              onMouseEnter={() => setIsHoveringProgress(true)}
              onMouseLeave={() => setIsHoveringProgress(false)}
            >
              {isHoveringProgress ? (
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
                <div className="relative w-full h-0.5 bg-white/30">
                  <div 
                    className="absolute top-0 left-0 h-full bg-red-500 transition-all"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
              )}
            </div>
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
                    <span className="text-xs md:text-sm text-white font-medium">{likeCount}</span>
                    <span className="hidden md:block text-xs text-white/80">Like</span>
                  </div>

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

                  {canDelete && onDelete && (
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
      </DialogContent>
    </Dialog>
  );
}
