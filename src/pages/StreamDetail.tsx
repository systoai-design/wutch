import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Heart, Share2, Circle, Wallet } from 'lucide-react';
import { mockStreams, mockStreamers } from '@/data/mockData';
import StreamCard from '@/components/StreamCard';
import DonationModal from '@/components/DonationModal';

const StreamDetail = () => {
  const { id } = useParams();
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const stream = mockStreams.find((s) => s.id === id);
  const streamer = stream ? mockStreamers[stream.streamerName] : null;
  const relatedStreams = mockStreams.filter((s) => s.id !== id).slice(0, 4);

  if (!stream || !streamer) {
    return <div className="p-8 text-center">Stream not found</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 lg:p-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
              <div className="text-center space-y-4">
                {stream.isLive && (
                  <Badge variant="destructive" className="bg-live text-live-foreground text-lg px-4 py-2">
                    <Circle className="h-4 w-4 mr-2 fill-current animate-pulse" />
                    LIVE
                  </Badge>
                )}
                <p className="text-muted-foreground">Pump.fun stream player will load here</p>
                <p className="text-xs text-muted-foreground font-mono">{stream.streamUrl}</p>
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
                  {stream.viewerCount.toLocaleString()} viewers
                </span>
                <span>•</span>
                <span>{new Date(stream.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link to={`/profile/${streamer.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={streamer.avatar} />
                  <AvatarFallback>{streamer.displayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{streamer.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {streamer.followerCount.toLocaleString()} followers
                  </p>
                </div>
              </Link>

              <div className="flex gap-2">
                <Button variant="outline" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button
                  variant="donation"
                  onClick={() => setIsDonationModalOpen(true)}
                  className="gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Donate
                </Button>
              </div>
            </div>

            <Card className="p-4">
              <Tabs defaultValue="description">
                <TabsList>
                  <TabsTrigger value="description">Description</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-4 space-y-4">
                  <p className="text-foreground">{stream.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {stream.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
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
            {relatedStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        </div>
      </div>

      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        streamerName={streamer.displayName}
        walletAddress={streamer.walletAddress}
      />
    </div>
  );
};

export default StreamDetail;
