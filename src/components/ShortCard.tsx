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
  return (
    <Link 
      to="/shorts" 
      className="group block w-full h-full rounded-lg overflow-hidden hover-scale transition-all"
    >
      <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden">
        {/* Thumbnail */}
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
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/90 rounded-full p-3">
            <Play className="h-8 w-8 text-primary fill-primary" />
          </div>
        </div>

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
