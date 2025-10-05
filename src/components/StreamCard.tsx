import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Circle, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface StreamCardProps {
  stream: Livestream;
  compact?: boolean;
  hasBounty?: boolean;
}

const StreamCard = ({ stream, compact = false, hasBounty = false }: StreamCardProps) => {
  const [streamer, setStreamer] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchStreamer = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', stream.user_id)
        .single();
      
      if (data) {
        setStreamer(data);
      }
    };

    fetchStreamer();
  }, [stream.user_id]);

  return (
    <Link to={`/stream/${stream.id}`} className="group block touch-manipulation">
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <div className={`relative aspect-video rounded-xl overflow-hidden bg-muted shadow-sm group-hover:shadow-lg transition-all duration-300 ${compact ? 'rounded-lg' : ''} ${hasBounty ? 'ring-2 ring-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.4)] animate-pulse' : ''}`}>
          <img
            src={stream.thumbnail_url || '/placeholder.svg'}
            alt={stream.title}
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
          {hasBounty && (
            <div className={compact ? 'absolute top-1.5 right-1.5' : 'absolute top-2 right-2'}>
              <Badge className={`bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold flex items-center gap-1 shadow-lg shadow-yellow-500/50 border-0 animate-pulse ${compact ? 'text-xs px-2.5 py-1' : 'px-3 py-1.5'}`}>
                <Coins className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                Bounty
              </Badge>
            </div>
          )}
          <div className={`absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm rounded-md font-bold flex items-center gap-1.5 shadow-md ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>
            <Eye className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {(stream.viewer_count || 0).toLocaleString()}
          </div>
          <div className={`absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${hasBounty ? 'bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10' : ''}`} />
        </div>

        <div className={`flex ${compact ? 'gap-2' : 'gap-3'}`}>
          <img
            src={streamer?.avatar_url || '/placeholder.svg'}
            alt={streamer?.username || 'Streamer'}
            className={`rounded-full flex-shrink-0 ring-2 ring-background ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}
          />
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors ${compact ? 'text-xs mb-0.5' : 'text-sm mb-1'}`}>
              {stream.title}
            </h3>
            <p className={`text-muted-foreground font-medium ${compact ? 'text-xs' : 'text-xs'}`}>
              {streamer?.display_name || streamer?.username || 'Loading...'}
            </p>
            {stream.category && !compact && (
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-xs font-semibold rounded-full px-2 py-0">
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
