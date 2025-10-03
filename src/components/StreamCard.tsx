import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface StreamCardProps {
  stream: Livestream;
}

const StreamCard = ({ stream }: StreamCardProps) => {
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
    <Link to={`/stream/${stream.id}`} className="group">
      <div className="space-y-3">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <img
            src={stream.thumbnail_url || '/placeholder.svg'}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          {stream.is_live && (
            <div className="absolute top-2 left-2">
              <Badge variant="destructive" className="bg-live text-live-foreground font-semibold flex items-center gap-1">
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                LIVE
              </Badge>
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-background/90 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {(stream.viewer_count || 0).toLocaleString()}
          </div>
        </div>

        <div className="flex gap-3">
          <img
            src={streamer?.avatar_url || '/placeholder.svg'}
            alt={streamer?.username || 'Streamer'}
            className="w-10 h-10 rounded-full flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {stream.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {streamer?.display_name || streamer?.username || 'Loading...'}
            </p>
            {stream.category && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
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
