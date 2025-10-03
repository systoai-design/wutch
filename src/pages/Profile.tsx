import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Wallet, Twitter, Globe } from 'lucide-react';
import { mockStreamers, mockStreams } from '@/data/mockData';
import StreamCard from '@/components/StreamCard';

const Profile = () => {
  const { username } = useParams();
  const streamer = username ? mockStreamers[username] : Object.values(mockStreamers)[0];
  const streamerStreams = mockStreams.filter((s) => s.streamerName === streamer?.username);

  if (!streamer) {
    return <div className="p-8 text-center">Profile not found</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-32 w-32">
              <AvatarImage src={streamer.avatar} />
              <AvatarFallback className="text-3xl">{streamer.displayName[0]}</AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{streamer.displayName}</h1>
                <p className="text-muted-foreground">@{streamer.username}</p>
              </div>

              <p className="text-foreground max-w-2xl">{streamer.bio}</p>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{streamer.followerCount.toLocaleString()}</span>
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{streamer.totalDonations} SOL</span>
                  <span className="text-muted-foreground">donated</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button>Follow</Button>
                <Button variant="outline">Message</Button>
                {streamer.socialLinks.twitter && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={streamer.socialLinks.twitter} target="_blank" rel="noopener noreferrer">
                      <Twitter className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {streamer.socialLinks.website && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={streamer.socialLinks.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="streams">
          <TabsList>
            <TabsTrigger value="streams">Streams</TabsTrigger>
            <TabsTrigger value="shorts">Shorts</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="streams" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {streamerStreams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shorts" className="mt-6">
            <p className="text-center text-muted-foreground py-8">No shorts yet</p>
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Wallet Address</h3>
                <div className="p-3 bg-muted rounded-lg text-sm font-mono break-all">
                  {streamer.walletAddress}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Social Links</h3>
                <div className="space-y-2">
                  {streamer.socialLinks.twitter && (
                    <a
                      href={streamer.socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </a>
                  )}
                  {streamer.socialLinks.discord && (
                    <a
                      href={streamer.socialLinks.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      Discord
                    </a>
                  )}
                  {streamer.socialLinks.website && (
                    <a
                      href={streamer.socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
