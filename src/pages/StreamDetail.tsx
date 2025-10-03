import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Heart, Share2, Timer, AlertCircle, ExternalLink } from 'lucide-react';
import StreamCard from '@/components/StreamCard';
import WatchTimeIndicator from '@/components/WatchTimeIndicator';
import ClaimBounty from '@/components/ClaimBounty';
import { EditStreamDialog } from '@/components/EditStreamDialog';
import { useAuth } from '@/hooks/useAuth';
import { useViewingSession } from '@/hooks/useViewingSession';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

const StreamDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [stream, setStream] = useState<Livestream | null>(null);
  const [streamer, setStreamer] = useState<Profile | null>(null);
  const [relatedStreams, setRelatedStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [isPumpFunOpen, setIsPumpFunOpen] = useState(false);
  const pumpFunWindowRef = useRef<Window | null>(null);

  // Track viewing session
  const { 
    watchTime, 
    formattedWatchTime, 
    isTabVisible, 
    meetsMinimumWatchTime,
    isSessionStarted 
  } = useViewingSession({ 
    livestreamId: id || '',
    shouldStart: hasStartedWatching,
    externalWindow: pumpFunWindowRef.current,
    onTimerStart: () => {
      toast.success('Timer Started!', {
        description: 'Keep both this page and Pump.fun open to earn rewards.',
        duration: 5000,
      });
    }
  });

  // Poll Pump.fun window to check if it's still open
  useEffect(() => {
    if (!pumpFunWindowRef.current) return;

    setIsPumpFunOpen(true);

    const checkInterval = setInterval(() => {
      if (pumpFunWindowRef.current?.closed) {
        setIsPumpFunOpen(false);
        toast.warning('Pump.fun Window Closed', {
          description: 'Watch time tracking has stopped. Reopen Pump.fun to continue.',
          duration: 5000,
        });
        pumpFunWindowRef.current = null;
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [pumpFunWindowRef.current]);

  const fetchStreamData = async () => {
      if (!id) return;

      try {
        // Fetch stream
        const { data: streamData, error: streamError } = await supabase
          .from('livestreams')
          .select('*')
          .eq('id', id)
          .single();

        if (streamError) {
          console.error('Error fetching stream:', streamError);
          setIsLoading(false);
          return;
        }

        setStream(streamData);

        // Fetch streamer profile
        const { data: streamerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', streamData.user_id)
          .single();

        if (streamerData) {
          setStreamer(streamerData);
        }

        // Fetch related streams
        const { data: relatedData } = await supabase
          .from('livestreams')
          .select('*')
          .neq('id', id)
          .eq('is_live', true)
          .limit(4);

        setRelatedStreams(relatedData || []);
      } catch (error) {
        console.error('Error fetching stream data:', error);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (stream) {
      document.title = `${stream.title} | Wutch`;
    }
  }, [stream]);

  useEffect(() => {
    fetchStreamData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stream || !streamer) {
    return <div className="p-8 text-center">Stream not found</div>;
  }

  const isOwner = user && stream.user_id === user.id;
  const socialLinks = (streamer.social_links as { twitter?: string; discord?: string; website?: string }) || {};

  return (
    <div className="min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 lg:p-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
              <div className="text-center space-y-6 p-8">
                {stream.is_live && (
                  <Badge variant="destructive" className="bg-live text-live-foreground text-lg px-4 py-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-current mr-2 animate-pulse" />
                    LIVE
                  </Badge>
                )}
                
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">Watch on Pump.fun</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    This stream is hosted on Pump.fun. Click the button below to watch.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="lg" 
                    className="gap-2"
                    onClick={() => {
                      if (!isOwner && user) {
                        setHasStartedWatching(true);
                      }
                      const newWindow = window.open(stream.pump_fun_url, '_blank', 'noopener,noreferrer');
                      if (newWindow && !isOwner && user) {
                        pumpFunWindowRef.current = newWindow;
                        setIsPumpFunOpen(true);
                      }
                    }}
                  >
                    <ExternalLink className="h-5 w-5" />
                    Watch Stream on Pump.fun
                  </Button>
                  
                  {isOwner && (
                    <EditStreamDialog stream={stream} onUpdate={fetchStreamData} />
                  )}
                </div>

                <p className="text-xs text-muted-foreground font-mono opacity-50">
                  {stream.pump_fun_url}
                </p>
              </div>
            </div>
          </div>

          {/* Stream Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{stream.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {(stream.viewer_count || 0).toLocaleString()} viewers
                </span>
                <span>•</span>
                <span>{new Date(stream.created_at || '').toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <Link to={`/profile/${streamer.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={streamer.avatar_url || '/placeholder.svg'} />
                  <AvatarFallback>
                    {(streamer.display_name || streamer.username)[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{streamer.display_name || streamer.username}</p>
                  <p className="text-sm text-muted-foreground">
                    {(streamer.follower_count || 0).toLocaleString()} followers
                  </p>
                </div>
              </Link>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
                
                <Button variant="outline" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>

            {/* Watch Time Tracker - Only show for non-owners */}
            {!isOwner && user && (
              <>
                {!isSessionStarted ? (
                  <Alert className="border-primary/20 bg-primary/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Click "Watch Stream on Pump.fun"</strong> above to start tracking your watch time and qualify for rewards.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Alert className="border-primary/20 bg-primary/5">
                      <Timer className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Important:</strong> Keep this page in focus AND the Pump.fun window open. 
                        Watch time only counts when both are active - closing Pump.fun or switching tabs will pause tracking.
                      </AlertDescription>
                    </Alert>
                    {!isPumpFunOpen && hasStartedWatching && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Stream window closed!</strong> Reopen Pump.fun to resume watch time tracking.
                        </AlertDescription>
                      </Alert>
                    )}
                    <WatchTimeIndicator
                      watchTime={watchTime}
                      formattedWatchTime={formattedWatchTime}
                      isTabVisible={isTabVisible}
                      isPumpFunOpen={isPumpFunOpen}
                      meetsMinimumWatchTime={meetsMinimumWatchTime}
                    />
                  </>
                )}
              </>
            )}

            {/* Bounty Claim - Only show for non-owners */}
            {!isOwner && user && isSessionStarted && (
              <ClaimBounty
                livestreamId={id!}
                watchTime={watchTime}
                meetsMinimumWatchTime={meetsMinimumWatchTime}
              />
            )}

            <Card className="p-4">
              <Tabs defaultValue="description">
                <TabsList>
                  <TabsTrigger value="description">Description</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-4 space-y-4">
                  <p className="text-foreground">{stream.description}</p>
                  {stream.tags && stream.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stream.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="chat" className="mt-4">
                  <p className="text-muted-foreground text-center py-8">
                    Chat functionality coming soon
                  </p>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Related Streams</h2>
          <div className="space-y-4">
            {relatedStreams.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No related streams</p>
            ) : (
              relatedStreams.map((relatedStream) => (
                <StreamCard key={relatedStream.id} stream={relatedStream} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamDetail;
