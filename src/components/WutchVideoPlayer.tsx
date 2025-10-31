import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings, AlertCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { VideoPlayerSettings } from '@/components/VideoPlayerSettings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Hls from 'hls.js';

interface Chapter {
  time: number;
  title: string;
}

interface WutchVideoPlayerProps {
  videoUrl: string;
  videoId: string;
  thumbnailUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
  hasAccess?: boolean;
  chapters?: Chapter[];
}

export const WutchVideoPlayer = ({ 
  videoUrl, 
  videoId, 
  thumbnailUrl, 
  onTimeUpdate, 
  className, 
  hasAccess = true,
  chapters = []
}: WutchVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isMobile = useIsMobile();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Stage 1: Loading & buffering states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;
  
  // Stage 2: Chapter states
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showChapters, setShowChapters] = useState(false);
  
  // Stage 3: HLS states
  const [availableQualities, setAvailableQualities] = useState<number[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number | 'auto'>('auto');
  const [isHLS, setIsHLS] = useState(false);
  
  // Thumbnail validation
  const [validPoster, setValidPoster] = useState<string | null>(null);

  // Validate thumbnail URL before using as poster
  useEffect(() => {
    if (!thumbnailUrl) {
      setValidPoster(null);
      return;
    }
    
    const img = new Image();
    img.onload = () => setValidPoster(thumbnailUrl);
    img.onerror = () => {
      console.warn('Thumbnail failed to load:', thumbnailUrl);
      setValidPoster(null);
    };
    img.src = thumbnailUrl;
  }, [thumbnailUrl]);

  // Initialize video player with HLS support
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHLSUrl = videoUrl.includes('.m3u8');
    setIsHLS(isHLSUrl);

    if (isHLSUrl) {
      // HLS streaming
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });
        
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest loaded');
          const levels = hls.levels.map(l => l.height);
          setAvailableQualities(levels);
          setIsLoading(false);
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network error - check your connection');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media error - trying to recover');
                hls.recoverMediaError();
                break;
              default:
                setError('Failed to load video stream');
                break;
            }
          }
        });
        
        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = videoUrl;
        setIsLoading(false);
      } else {
        setError('Your browser does not support HLS streaming');
      }
    } else {
      // Regular MP4 video
      video.src = videoUrl;
    }
  }, [videoUrl]);

  // Stage 1: Enhanced event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };
    
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        const progress = (buffered / video.duration) * 100;
        setLoadProgress(progress);
      }
    };
    
    const handleError = () => {
      const error = video.error;
      let message = 'Failed to load video';
      let shouldRetry = false;
      
      if (error) {
        console.error('[WutchVideoPlayer] Error details:', {
          code: error.code,
          message: error.message,
          videoUrl,
          videoId,
          retryCount,
        });
        
        switch (error.code) {
          case 1: 
            message = 'Video loading was aborted';
            break;
          case 2: 
            message = 'Network issue - check your connection';
            shouldRetry = true;
            break;
          case 3: 
            message = 'Video format not supported by your browser';
            break;
          case 4: 
            message = 'Video source not found. Try refreshing the page.';
            shouldRetry = true;
            break;
        }
      }
      
      // Retry logic for network and not found errors
      if (shouldRetry && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`[WutchVideoPlayer] Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setIsRetrying(true);
        
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setError(null);
          setIsRetrying(false);
          video.load();
        }, delay);
      } else {
        setError(message);
        setIsLoading(false);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate]);

  // Stage 2: Track current chapter
  useEffect(() => {
    if (chapters.length > 0) {
      // Find last chapter that started before current time
      let chapterIndex = 0;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (chapters[i].time <= currentTime) {
          chapterIndex = i;
          break;
        }
      }
      if (chapterIndex !== currentChapter) {
        setCurrentChapter(chapterIndex);
      }
    }
  }, [currentTime, chapters]);

  // Stage 3: Quality switching
  const changeQuality = useCallback((quality: number | 'auto') => {
    if (hlsRef.current && quality !== 'auto') {
      const levelIndex = hlsRef.current.levels.findIndex(l => l.height === quality);
      if (levelIndex !== -1) {
        hlsRef.current.currentLevel = levelIndex;
        setSelectedQuality(quality);
      }
    } else if (hlsRef.current) {
      hlsRef.current.currentLevel = -1; // Auto
      setSelectedQuality('auto');
    }
  }, []);

  // Apply playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Play error:', err);
          setError('Failed to play video');
        });
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const jumpToChapter = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setShowChapters(false);
    }
  };

  const handleInteraction = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      handleInteraction();
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && !isHoveringVolume) {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  };

  const handleClick = () => {
    if (isMobile) {
      handleInteraction();
    } else {
      togglePlay();
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Don't render video if no access
  if (!hasAccess) {
    return (
      <div className={cn("relative bg-black rounded-lg overflow-hidden flex items-center justify-center", className)}>
        <div className="text-white/50">Premium content locked</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black rounded-lg overflow-hidden group", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={isMobile ? handleInteraction : undefined}
    >
      <video
        ref={videoRef}
        poster={validPoster || undefined}
        className="w-full h-full object-contain max-h-[100dvh]"
        onClick={handleClick}
        playsInline
        preload="metadata"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30">
          <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
          <p className="text-white text-sm">Loading video...</p>
        </div>
      )}

      {/* Buffering overlay */}
      {isBuffering && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <Loader2 className="h-16 w-16 text-white animate-spin" />
        </div>
      )}

      {/* Retry overlay */}
      {isRetrying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30">
          <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
          <p className="text-white text-sm">Retrying... (Attempt {retryCount + 1}/{maxRetries})</p>
        </div>
      )}

      {/* Error overlay */}
      {error && !isRetrying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-40 p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>{error}</p>
                {retryCount >= maxRetries && (
                  <p className="text-xs opacity-80">
                    Tried {maxRetries} times. The video may still be processing or there could be a connection issue.
                  </p>
                )}
              </div>
            </AlertDescription>
            <div className="flex gap-2 mt-4">
              <Button 
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Current chapter overlay */}
      {chapters.length > 0 && currentChapter < chapters.length && !isLoading && !error && (
        <div className="absolute top-4 left-4 bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-sm z-20">
          <div className="text-white text-sm font-medium">
            {chapters[currentChapter].title}
          </div>
        </div>
      )}

      {/* Center play/pause overlay */}
      {!isPlaying && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Button
            size="icon"
            variant="ghost"
            className="h-20 w-20 rounded-full bg-black/60 hover:bg-black/70 backdrop-blur-sm transition-all"
            onClick={togglePlay}
          >
            <Play className="h-10 w-10 text-white ml-1" />
          </Button>
        </div>
      )}

      {/* Buffered progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div 
          className="h-full bg-white/30 transition-all"
          style={{ width: `${loadProgress}%` }}
        />
        <div 
          className="h-full bg-primary transition-all absolute top-0 left-0"
          style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      {/* Chapters panel */}
      {showChapters && chapters.length > 0 && (
        <div className="absolute right-4 bottom-20 bg-black/95 rounded-lg p-3 max-h-64 overflow-y-auto w-72 z-40 backdrop-blur-sm">
          <h4 className="text-sm font-semibold mb-2 text-white">Chapters</h4>
          <div className="space-y-1">
            {chapters.map((chapter, index) => (
              <button
                key={index}
                onClick={() => jumpToChapter(chapter.time)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                  currentChapter === index 
                    ? "bg-primary text-primary-foreground" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="font-medium">{formatTime(chapter.time)}</div>
                <div className="text-xs opacity-80 truncate">{chapter.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity pointer-events-none",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 space-y-3 pointer-events-auto">
          {/* Interactive progress bar with chapter markers */}
          <div 
            className="relative group/progress cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              handleSeek([pos * duration]);
            }}
          >
            <div className="h-1 bg-white/30 rounded-full overflow-hidden group-hover/progress:h-1.5 transition-all relative">
              {/* Chapter markers */}
              {chapters.map((chapter, index) => (
                <div
                  key={index}
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40 hover:bg-white transition-colors cursor-pointer z-10"
                  style={{ left: `${(chapter.time / duration) * 100}%` }}
                  title={chapter.title}
                />
              ))}
              <div 
                className="h-full bg-primary relative z-20"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white hover:text-white hover:bg-white/20 shrink-0"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>

            {/* Volume */}
            <div 
              className="flex items-center gap-2"
              onMouseEnter={() => setIsHoveringVolume(true)}
              onMouseLeave={() => setIsHoveringVolume(false)}
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-white hover:text-white hover:bg-white/20 shrink-0"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
              {isHoveringVolume && (
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-20 cursor-pointer"
                />
              )}
            </div>

            {/* Time */}
            <div className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="flex-1" />

            {/* Chapters button */}
            {chapters.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:text-white hover:bg-white/20 text-xs"
                onClick={() => setShowChapters(!showChapters)}
              >
                Chapters ({chapters.length})
              </Button>
            )}

            {/* Quality selector for HLS */}
            {isHLS && availableQualities.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 h-9">
                    <Settings className="h-4 w-4 mr-1" />
                    {selectedQuality === 'auto' ? 'Auto' : `${selectedQuality}p`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => changeQuality('auto')}>
                    Auto (recommended)
                  </DropdownMenuItem>
                  {availableQualities.map(quality => (
                    <DropdownMenuItem 
                      key={quality} 
                      onClick={() => changeQuality(quality)}
                    >
                      {quality}p
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Playback speed */}
            <VideoPlayerSettings 
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
            />

            {/* Fullscreen */}
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-white hover:text-white hover:bg-white/20 shrink-0"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};