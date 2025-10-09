import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { generateContentUrl } from '@/utils/urlHelpers';
import { optimizeImage } from '@/utils/imageOptimization';

interface WutchVideoCardCompactProps {
  video: {
    id: string;
    title: string;
    thumbnail_url?: string;
    video_url?: string;
    duration?: number;
    view_count: number;
    created_at: string;
    user_id: string;
    profiles?: {
      username: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  className?: string;
}

const formatDuration = (seconds?: number) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatViewCount = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

export const WutchVideoCardCompact = ({ video, className }: WutchVideoCardCompactProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const videoUrl = generateContentUrl('wutch', {
    id: video.id,
    title: video.title,
    profiles: video.profiles ? { username: video.profiles.username } : undefined
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current && video.video_url) {
      videoRef.current.currentTime = 0;
      
      const attemptPlay = () => {
        videoRef.current!.play().then(() => {
          setIsPlaying(true);
          // Stop after 10 seconds
          timeoutRef.current = setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
              setIsPlaying(false);
            }
          }, 10000);
        }).catch(() => {
          // Ignore autoplay failures
        });
      };

      // Check if video is ready to play
      if (videoRef.current.readyState >= 2) {
        attemptPlay();
      } else {
        const handleCanPlay = () => {
          attemptPlay();
          videoRef.current?.removeEventListener('loadeddata', handleCanPlay);
        };
        videoRef.current.addEventListener('loadeddata', handleCanPlay);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsPlaying(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link
      to={videoUrl}
      className={cn(
        "flex gap-2 group hover:bg-muted/50 rounded-lg p-2 transition-colors",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail/Video */}
      <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-muted">
        {!isPlaying && video.thumbnail_url ? (
          <img
            src={optimizeImage(video.thumbnail_url, { width: 160, height: 90 })}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="eager"
          />
        ) : video.video_url && isHovering ? (
          <video
            ref={videoRef}
            src={video.video_url}
            className="w-full h-full object-cover"
            preload={isHovering ? "metadata" : "none"}
            playsInline
            muted
            loop={false}
          />
        ) : !video.thumbnail_url ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Eye className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : null}
        
        {/* Duration Badge */}
        {video.duration && !isPlaying && (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title */}
        <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors leading-tight">
          {video.title}
        </h3>

        {/* Creator */}
        {video.profiles && (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={video.profiles.avatar_url} />
              <AvatarFallback className="text-[10px]">
                {video.profiles.display_name?.[0] || video.profiles.username?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground truncate">
              {video.profiles.display_name || video.profiles.username}
            </p>
          </div>
        )}

        {/* Views & Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" />
          <span>{formatViewCount(video.view_count)}</span>
          <span>•</span>
          <span className="truncate">
            {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
};
