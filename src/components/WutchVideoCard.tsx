import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Eye, ThumbsUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WutchVideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnail_url?: string;
    video_url: string;
    duration?: number;
    view_count: number;
    like_count: number;
    created_at: string;
    category?: string;
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

export const WutchVideoCard = ({ video, className }: WutchVideoCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

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
      videoRef.current.play().then(() => {
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
      to={`/wutch/${video.id}`} 
      className={cn("group block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="space-y-3">
        {/* Thumbnail/Video */}
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {!isPlaying && video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : video.video_url ? (
            <video
              ref={videoRef}
              src={video.video_url}
              className="h-full w-full object-cover"
              preload={isHovering ? "metadata" : "none"}
              playsInline
              muted
              loop={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-4xl font-bold text-primary/40">W</span>
            </div>
          )}
          
          {/* Duration badge */}
          {video.duration && !isPlaying && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(video.duration)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={video.profiles?.avatar_url} />
            <AvatarFallback>
              {video.profiles?.display_name?.[0] || video.profiles?.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {video.title}
            </h3>
            
            <p className="text-xs text-muted-foreground">
              {video.profiles?.display_name || video.profiles?.username || 'Unknown Creator'}
            </p>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{formatViewCount(video.view_count)} views</span>
              </div>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
            </div>

            {video.category && (
              <Badge variant="secondary" className="text-xs">
                {video.category}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
