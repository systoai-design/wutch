import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Wallet, Twitter, Globe, Shield } from 'lucide-react';
import StreamCard from '@/components/StreamCard';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { MFAEnrollment } from '@/components/MFAEnrollment';
import { useToast } from '@/hooks/use-toast';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Livestream = Database['public']['Tables']['livestreams']['Row'];

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ownWalletAddress, setOwnWalletAddress] = useState<string | null>(null);
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);
  const [hasMFA, setHasMFA] = useState(false);

  useEffect(() => {
    document.title = username ? `@${username} - Profile | Wutch` : 'Profile | Wutch';
  }, [username]);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // If no username in URL, redirect to current user's profile
        if (!username && user) {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          
          if (currentProfile) {
            navigate(`/profile/${currentProfile.username}`, { replace: true });
            return;
          }
        }

        // Fetch profile by username
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username || '')
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setIsLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch user's streams
        const { data: streamsData } = await supabase
          .from('livestreams')
          .select('*')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        setStreams(streamsData || []);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [username, user, navigate]);

  useEffect(() => {
    const checkMFAStatus = async () => {
      if (user) {
        const { data } = await supabase.auth.mfa.listFactors();
        setHasMFA(data && data.totp && data.totp.length > 0 || false);
      }
    };
    checkMFAStatus();
  }, [user]);

  const handleDisableMFA = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: totpFactor.id,
        });

        if (error) throw error;

        setHasMFA(false);
        toast({
          title: 'Success',
          description: '2FA has been disabled',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not disable 2FA',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center">Profile not found</div>;
  }

  const isOwnProfile = user?.id === profile.id;
  const socialLinks = (profile.social_links as { twitter?: string; discord?: string; website?: string }) || {};

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <Avatar className="h-32 w-32">
              <AvatarImage src={profile.avatar_url || '/placeholder.svg'} />
              <AvatarFallback className="text-3xl">
                {(profile.display_name || profile.username)[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.display_name || profile.username}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>

              {profile.bio && <p className="text-foreground max-w-2xl">{profile.bio}</p>}

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{(profile.follower_count || 0).toLocaleString()}</span>
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{profile.total_donations_received || 0} SOL</span>
                  <span className="text-muted-foreground">donated</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {isOwnProfile ? (
                  <EditProfileDialog 
                    profile={profile} 
                    onProfileUpdate={(updatedProfile) => setProfile(updatedProfile)} 
                  />
                ) : (
                  <>
                    <Button>Follow</Button>
                    <Button variant="outline">Message</Button>
                  </>
                )}
                {socialLinks.twitter && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer">
                      <Twitter className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {socialLinks.website && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={socialLinks.website} target="_blank" rel="noopener noreferrer">
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
            {streams.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No streams yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shorts" className="mt-6">
            <p className="text-center text-muted-foreground py-8">No shorts yet</p>
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <Card className="p-6 space-y-4">
              {isOwnProfile && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Two-Factor Authentication
                  </h3>
                  {showMFAEnrollment ? (
                    <MFAEnrollment
                      onEnrollmentComplete={() => {
                        setShowMFAEnrollment(false);
                        setHasMFA(true);
                      }}
                      onCancel={() => setShowMFAEnrollment(false)}
                    />
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">
                          {hasMFA ? '2FA Enabled' : '2FA Disabled'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasMFA
                            ? 'Your account is protected with two-factor authentication'
                            : 'Add an extra layer of security to your account'}
                        </p>
                      </div>
                      {hasMFA ? (
                        <Button variant="destructive" onClick={handleDisableMFA}>
                          Disable
                        </Button>
                      ) : (
                        <Button onClick={() => setShowMFAEnrollment(true)}>
                          Enable 2FA
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isOwnProfile && profile.wallet_address && (
                <div>
                  <h3 className="font-semibold mb-2">Wallet Address</h3>
                  <div className="p-3 bg-muted rounded-lg text-sm font-mono break-all">
                    {profile.wallet_address}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Only visible to you
                  </p>
                </div>
              )}

              {(socialLinks.twitter || socialLinks.discord || socialLinks.website) && (
                <div>
                  <h3 className="font-semibold mb-2">Social Links</h3>
                  <div className="space-y-2">
                    {socialLinks.twitter && (
                      <a
                        href={socialLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Twitter className="h-4 w-4" />
                        Twitter
                      </a>
                    )}
                    {socialLinks.discord && (
                      <a
                        href={socialLinks.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        Discord
                      </a>
                    )}
                    {socialLinks.website && (
                      <a
                        href={socialLinks.website}
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
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;
