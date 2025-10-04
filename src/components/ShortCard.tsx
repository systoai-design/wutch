import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url'>;
};

interface ShortCardProps {
  short: ShortVideo;
}

const ShortCard = ({ short }: ShortCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    return () => {
      // Cleanup timeouts on unmount
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (isMobile) return; // Disable hover preview on mobile
    
    setIsHovering(true);
    
    // Start playing after 1.5 second delay
    hoverTimeoutRef.current = setTimeout(() => {
      if (videoRef.current) {
        setShowThumbnail(false);
        videoRef.current.currentTime = 0;
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          
          // Auto-stop after 5 seconds
          playTimeoutRef.current = setTimeout(() => {
            handleMouseLeave();
          }, 5000);
        }).catch(err => {
          console.log('Video play prevented:', err);
        });
      }
    }, 1500);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsPlaying(false);
    setShowThumbnail(true);
    
    // Clear timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    
    // Pause and reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link 
      to="/shorts" 
      className="group block w-full h-full rounded-lg overflow-hidden hover-scale transition-all"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Watch ${short.title}`}
    >
      <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
        {/* Video Element (always present but hidden when not playing) */}
        <video
          ref={videoRef}
          src={short.video_url}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isPlaying && !showThumbnail ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          muted
          playsInline
          preload="metadata"
          loop={false}
        />
        
        {/* Thumbnail */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${
          showThumbnail ? 'opacity-100 z-20' : 'opacity-0 z-0'
        }`}>
          {short.thumbnail_url ? (
            <img
              src={short.thumbnail_url}
              alt={short.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Play className="h-12 w-12 text-primary" />
            </div>
          )}
        </div>
        
        {/* Play Overlay - only show when not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
            <div className="bg-white/90 rounded-full p-3 animate-pulse">
              <Play className="h-8 w-8 text-primary fill-primary" />
            </div>
          </div>
        )}

        {/* Duration Badge */}
        {short.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {Math.floor(short.duration / 60)}:{(short.duration % 60).toString().padStart(2, '0')}
          </div>
        )}

        {/* View Count */}
        <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {short.view_count || 0}
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 px-1">
        <h3 className="font-medium text-sm line-clamp-2 mb-1">{short.title}</h3>
        <div className="flex items-center gap-2">
          {short.profiles?.avatar_url && (
            <img
              src={short.profiles.avatar_url}
              alt={short.profiles.username || 'User'}
              className="w-6 h-6 rounded-full"
            />
          )}
          <p className="text-xs text-muted-foreground truncate">
            {short.profiles?.display_name || short.profiles?.username || 'Anonymous'}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ShortCard;
