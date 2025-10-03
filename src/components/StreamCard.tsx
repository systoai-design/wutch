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
    <Link to={`/stream/${stream.id}`} className="group block">
      <div className="space-y-3">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-sm group-hover:shadow-lg transition-all duration-300">
          <img
            src={stream.thumbnail_url || '/placeholder.svg'}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {stream.is_live && (
            <div className="absolute top-2 left-2">
              <Badge variant="destructive" className="bg-live text-live-foreground font-bold flex items-center gap-1 shadow-lg px-2.5 py-1">
                <Circle className="h-2 w-2 fill-current animate-pulse" />
                LIVE
              </Badge>
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md">
            <Eye className="h-3.5 w-3.5" />
            {(stream.viewer_count || 0).toLocaleString()}
          </div>
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        <div className="flex gap-3">
          <img
            src={streamer?.avatar_url || '/placeholder.svg'}
            alt={streamer?.username || 'Streamer'}
            className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-background"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors mb-1">
              {stream.title}
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              {streamer?.display_name || streamer?.username || 'Loading...'}
            </p>
            {stream.category && (
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
