import { Link, useNavigate } from 'react-router-dom';
import { Eye, Circle, Coins, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';
import { generateContentUrl } from '@/utils/urlHelpers';
import { getCategoryIcon } from '@/constants/categories';
import { optimizeImage, generateSrcSet, imagePresets } from '@/utils/imageOptimization';
import { VerificationBadge } from '@/components/VerificationBadge';

type Livestream = Database['public']['Tables']['livestreams']['Row'];

interface StreamCardProps {
  stream: Livestream & {
    profiles?: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verification_type?: string | null;
    };
  };
  compact?: boolean;
  hasBounty?: boolean;
  hasShareCampaign?: boolean;
}

const StreamCard = ({ stream, compact = false, hasBounty = false, hasShareCampaign = false }: StreamCardProps) => {
  const navigate = useNavigate();
  const streamUrl = generateContentUrl('stream', {
    id: stream.id,
    title: stream.title,
    profiles: stream.profiles ? { username: stream.profiles.username } : undefined
  });
  const streamer = stream.profiles;
  const CategoryIcon = stream.category ? getCategoryIcon(stream.category) : null;

  return (
    <Link to={streamUrl} className="group block touch-manipulation">
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-muted shadow-sm group-hover:shadow-lg transition-all duration-500 ${compact ? 'rounded-lg' : ''} ${hasBounty ? 'ring-1 ring-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : ''}`}>
          <img
            src={optimizeImage(stream.thumbnail_url, imagePresets.thumbnail)}
            srcSet={generateSrcSet(stream.thumbnail_url)}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={stream.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {stream.is_live && (
            <div className={compact ? 'absolute top-1.5 left-1.5' : 'absolute top-2 left-2'}>
              <Badge variant="destructive" className={`bg-live text-live-foreground font-bold flex items-center gap-1 shadow-lg ${compact ? 'text-xs px-2 py-0.5' : 'px-2.5 py-1'}`}>
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                LIVE
              </Badge>
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
            {hasShareCampaign && (
              <Badge className={`bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold flex items-center gap-1 shadow-lg border-0 ${compact ? 'text-xs px-2 py-0.5' : 'px-2.5 py-1'}`}>
                <Share2 className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                {!compact && 'Share'}
              </Badge>
            )}
            {hasBounty && (
              <Badge className={`bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-bold flex items-center gap-1 shadow-md shadow-yellow-500/20 border-0 ml-auto ${compact ? 'text-xs px-2.5 py-1' : 'px-3 py-1.5'}`}>
                <Coins className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                {!compact && 'Bounty'}
              </Badge>
            )}
          </div>
          <div className={`absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm rounded-md font-bold flex items-center gap-1.5 shadow-md ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
            <Eye className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {(stream.viewer_count || 0).toLocaleString()}
          </div>
          <div className={`absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${hasBounty ? 'bg-gradient-to-br from-yellow-500/5 via-transparent to-amber-500/5' : ''}`} />
        </div>

        <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
          <img
            src={optimizeImage(streamer?.avatar_url, imagePresets.avatarSmall)}
            alt={streamer?.username || 'Streamer'}
            loading="lazy"
            className={`rounded-full flex-shrink-0 ring-2 ring-background ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}
          />
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors ${compact ? 'text-xs mb-0.5' : 'text-sm mb-1'}`}>
              {stream.title}
            </h3>
            <p className={`text-muted-foreground font-medium flex items-center gap-1 ${compact ? 'text-xs' : 'text-xs'}`}>
              {streamer?.display_name || streamer?.username || 'Loading...'}
              {streamer?.verification_type && streamer.verification_type !== 'none' && (
                <VerificationBadge verificationType={streamer.verification_type as 'blue' | 'red'} size="sm" />
              )}
            </p>
            {stream.category && !compact && (
              <div className="flex items-center gap-2 mt-1.5">
                <Badge 
                  variant="secondary" 
                  className="text-xs font-semibold rounded-full px-2 py-0 cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/app?category=${encodeURIComponent(stream.category!)}`);
                  }}
                >
                  {CategoryIcon && <CategoryIcon className="h-3 w-3 mr-1" />}
                  {stream.category}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default StreamCard;
