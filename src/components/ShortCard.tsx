import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatNumber } from '@/utils/formatters';
import { Database } from '@/integrations/supabase/types';
import { optimizeImage, imagePresets } from '@/utils/imageOptimization';
import { VerificationBadge } from '@/components/VerificationBadge';
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'> & {
    verification_type?: string | null;
  };
};

interface ShortCardProps {
  short: ShortVideo;
  commentCount?: number;
  onClick?: () => void;
}

export function ShortCard({ short, commentCount = 0, onClick }: ShortCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const { isAdmin, isModerator } = useUserRoles(short.user_id);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    const video = videoRef.current;
    if (!video || !short.video_url) return;

    video.currentTime = 0;
    
    const attemptPlay = () => {
      video.play()
        .then(() => {
          setIsPlaying(true);
          // Stop after 10 seconds
          timeoutRef.current = setTimeout(() => {
            if (video) {
              video.pause();
              video.currentTime = 0;
              setIsPlaying(false);
            }
          }, 10000);
        })
        .catch(() => {
          // Ignore autoplay failures
        });
    };

    // Wait for video to be ready before playing
    if (video.readyState >= 2) {
      // HAVE_CURRENT_DATA or greater
      attemptPlay();
    } else {
      const handleCanPlay = () => {
        attemptPlay();
        video.removeEventListener('loadeddata', handleCanPlay);
      };
      video.addEventListener('loadeddata', handleCanPlay);
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

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: navigate to shorts page
      window.location.href = '/shorts';
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-card will-change-transform"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Aspect Ratio Container (9:16 for vertical video) */}
      <div className="relative aspect-[9/16] bg-muted">
        {/* Video Element - Always in DOM */}
        {short.video_url && (
          <video
            ref={videoRef}
            src={short.video_url}
            className="w-full h-full object-cover"
            preload="metadata"
            playsInline
            muted
            loop={false}
          />
        )}
        
        {/* Thumbnail Overlay - Show when not playing */}
        {!isPlaying && short.thumbnail_url && (
          <img
            src={optimizeImage(short.thumbnail_url, { width: 400, quality: 80 })}
            alt={short.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        
        {/* Stats Overlay - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
            <Eye className="h-3 w-3 text-white" />
            <span className="text-xs text-white font-medium">
              {formatNumber(short.view_count || 0)}
            </span>
          </div>
        </div>
        
        {/* Content Overlay - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          {/* Creator Info */}
          <div className="flex items-center gap-2 mb-2">
            {short.profiles?.avatar_url && (
              <img
                src={optimizeImage(short.profiles.avatar_url, imagePresets.avatarSmall)}
                alt={short.profiles.username || 'User'}
                loading="lazy"
                className="w-8 h-8 rounded-full border border-white/30"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate flex items-center gap-1">
                {short.profiles?.display_name || short.profiles?.username || 'Anonymous'}
                <UserBadges
                  userId={short.user_id}
                  verificationType={short.profiles?.verification_type as 'blue' | 'red' | 'none' | null}
                  isAdmin={isAdmin}
                  isModerator={isModerator}
                  size="sm"
                />
              </p>
            </div>
          </div>
          
          {/* Title */}
          <h3 className="text-sm font-semibold line-clamp-2 mb-2">
            {short.title}
          </h3>
          
          {/* Engagement Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{formatNumber(short.like_count || 0)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{formatNumber(commentCount)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
