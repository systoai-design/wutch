import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Wallet, Twitter, Globe, Shield, UserX, ExternalLink, Copy, Video, Film, PlayCircle, Maximize2, CalendarDays, Settings as SettingsIcon, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import StreamCard from '@/components/StreamCard';
import { ShortCard } from '@/components/ShortCard';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import { SkeletonStreamCard, SkeletonShortCard, SkeletonVideoCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { MFAEnrollment } from '@/components/MFAEnrollment';
import { ProfileAnalytics } from '@/components/ProfileAnalytics';
import { DonationSettings } from '@/components/DonationSettings';
import { ProfileFinancialStats } from '@/components/ProfileFinancialStats';
import { ImageViewer } from '@/components/ImageViewer';
import { WalletStatusBadge } from '@/components/WalletStatusBadge';
import { WalletEducationPanel } from '@/components/WalletEducationPanel';
import { PublicWalletButton } from '@/components/PublicWalletButton';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { VerificationBadge } from '@/components/VerificationBadge';
import { VerificationRequestDialog } from '@/components/VerificationRequestDialog';

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  verification_type?: string | null;
  verified_at?: string | null;
};
type PublicProfile = Omit<Profile, 'total_earnings' | 'pending_earnings' | 'total_donations_received' | 'last_payout_at' | 'updated_at'> & {
  verification_type?: string | null;
  verified_at?: string | null;
};
type DisplayProfile = Profile | PublicProfile;

type LivestreamWithProfile = Database['public']['Tables']['livestreams']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type WutchVideo = Database['public']['Tables']['wutch_videos']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

// Component to display user's private wallet address (only visible to owner)
function ProfileWalletDisplay({ userId }: { userId: string }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [firstConnectedAt, setFirstConnectedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadWallet = async () => {
      const { data } = await supabase
        .from('profile_wallets')
        .select('wallet_address, first_connected_at')
        .eq('user_id', userId)
        .single();
      
      if (data?.wallet_address) {
        setWalletAddress(data.wallet_address);
        setFirstConnectedAt(data.first_connected_at);
      }
    };
    loadWallet();
  }, [userId]);

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Wallet address copied to clipboard',
    });
  };

  if (!walletAddress) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          No wallet connected. Connect your wallet in Edit Profile to receive donations and claim rewards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Connected Wallet</h3>
        <WalletStatusBadge isConnected={!!walletAddress} />
      </div>
      <div className="p-4 bg-muted rounded-lg space-y-2">
        <div className="flex items-center justify-between gap-2">
          <code className="text-sm font-mono break-all flex-1">
            {walletAddress}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2 shrink-0"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        {firstConnectedAt && (
          <p className="text-xs text-muted-foreground">
            Connected {formatDistanceToNow(new Date(firstConnectedAt), { addSuffix: true })}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Only visible to you. Manage your wallet in Edit Profile.
      </p>
    </div>
  );
}

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [streams, setStreams] = useState<LivestreamWithProfile[]>([]);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [videos, setVideos] = useState<WutchVideo[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStreams, setIsLoadingStreams] = useState(true);
  const [isLoadingShorts, setIsLoadingShorts] = useState(true);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);
  const [hasMFA, setHasMFA] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; alt: string } | null>(null);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verificationType, setVerificationType] = useState<'blue' | 'red'>('blue');
  
  const activeTab = searchParams.get('tab') || 'streams';

  const tabsScrollRef = useRef<HTMLDivElement | null>(null);

  const handleViewImage = (url: string, alt: string) => {
    setViewingImage({ url, alt });
    setImageViewerOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!profile || !isAdmin) return;

    try {
      // Delete all user's livestreams
      await supabase
        .from('livestreams')
        .delete()
        .eq('user_id', profile.id);

      // Delete all user's short videos
      await supabase
        .from('short_videos')
        .delete()
        .eq('user_id', profile.id);

      // Delete user's profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: 'User deleted',
        description: 'The user and all their content has been removed.',
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

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

        // Fetch profile from public_profiles view
        const { data: publicProfileData, error: profileError } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, bio, follower_count, is_verified, social_links, banner_url, created_at, promotional_link, promotional_link_text, public_wallet_address, verification_type, verified_at')
          .eq('username', username || '')
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          setIsLoading(false);
          return;
        }

        // If viewing own profile, fetch full data including financial info
        let profileData = publicProfileData;
        if (user && publicProfileData.id === user.id) {
          const { data: fullProfileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (fullProfileData) {
            profileData = fullProfileData as any;
          }
        }

        setProfile(profileData as DisplayProfile);
        setFollowerCount(profileData.follower_count || 0);

        // Fetch user's streams with profile info
        setIsLoadingStreams(true);
        const { data: streamsData } = await supabase
          .from('livestreams')
          .select('*')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        // Enrich with profile data
        const streamsWithProfile = (streamsData || []).map(stream => ({
          ...stream,
          profiles: {
            username: profileData.username,
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
          }
        }));
        setStreams(streamsWithProfile);
        setIsLoadingStreams(false);

        // Fetch user's shorts with profile info
        setIsLoadingShorts(true);
        const { data: shortsData } = await supabase
          .from('short_videos')
          .select('*')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        // Enrich with profile data
        const shortsWithProfile = (shortsData || []).map(short => ({
          ...short,
          profiles: {
            username: profileData.username,
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
          }
        }));
        setShorts(shortsWithProfile as any);
        setIsLoadingShorts(false);

        // Fetch user's wutch videos with profile info
        setIsLoadingVideos(true);
        const { data: videosData } = await supabase
          .from('wutch_videos')
          .select('*')
          .eq('user_id', profileData.id)
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        // Enrich with profile data
        const videosWithProfile = (videosData || []).map(video => ({
          ...video,
          profiles: {
            username: profileData.username,
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
          }
        }));
        setVideos(videosWithProfile);
        setIsLoadingVideos(false);

        // Check if current user is following this profile
        if (user && user.id !== profileData.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', user.id)
            .eq('following_id', profileData.id)
            .maybeSingle();
          
          setIsFollowing(!!followData);
        }
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

  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;
    const active = container.querySelector('[role="tab"][data-state="active"]') as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      if (active.getAttribute('value') === 'streams') {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  }, [activeTab]);

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

  const handleFollow = async () => {
    if (!user || !profile) return;

    // Optimistic update
    setIsFollowing(!isFollowing);
    setFollowerCount(prev => isFollowing ? prev - 1 : prev + 1);

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);

        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profile.id,
          });

        if (error) throw error;
      }
    } catch (error: any) {
      // Revert on error
      setIsFollowing(isFollowing);
      setFollowerCount(followerCount);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
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

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen">
      {/* Banner */}
      {profile.banner_url ? (
        <div 
          className="relative h-32 md:h-48 lg:h-64 w-full overflow-hidden group cursor-pointer"
          onClick={() => handleViewImage(profile.banner_url || '', `${profile.username}'s banner`)}
        >
          <img 
            src={profile.banner_url} 
            alt="Profile banner" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Maximize2 className="w-12 h-12 text-white" />
          </div>
        </div>
      ) : (
        <div className="h-32 md:h-48 lg:h-64 w-full bg-gradient-to-br from-primary/20 to-primary/5" />
      )}

      {/* Header */}
      <div className="border-b border-border bg-card -mt-12 md:-mt-16 relative">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
            <div 
              className="relative group cursor-pointer"
              onClick={() => handleViewImage(profile.avatar_url || '', `${profile.username}'s avatar`)}
            >
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background">
                <AvatarImage src={profile.avatar_url || '/placeholder.svg'} />
                <AvatarFallback className="text-2xl md:text-3xl">
                  {(profile.display_name || profile.username)[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="flex-1 space-y-3 md:space-y-4 w-full">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">{profile.display_name || profile.username}</h1>
                <p className="text-sm md:text-base text-muted-foreground">@{profile.username}</p>
              </div>

              {profile.bio && (
                <p className="text-sm md:text-base text-foreground max-w-2xl line-clamp-3">
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  <span className="font-semibold">{followerCount.toLocaleString()}</span>
                  <span className="text-muted-foreground">followers</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  <span className="font-semibold">
                    {'total_donations_received' in profile ? (profile.total_donations_received || 0) : 0} SOL
                  </span>
                  <span className="text-muted-foreground">donated</span>
                </div>
              </div>

              <ProfileFinancialStats 
                userId={profile.id}
                isOwnProfile={isOwnProfile}
                className="mt-4"
              />


              <div className="flex flex-wrap gap-2 items-center">
                {isOwnProfile && 'total_earnings' in profile ? (
                  <>
                    <EditProfileDialog 
                      profile={profile as Profile} 
                      onProfileUpdate={(updatedProfile) => setProfile(updatedProfile)} 
                    />
                    {!profile.is_verified && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setVerificationType('blue');
                          setVerificationDialogOpen(true);
                        }}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Get Verified
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button onClick={handleFollow} variant={isFollowing ? "outline" : "default"}>
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowMessageDialog(true)}>
                      Message
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this user? This will permanently remove their profile and all their content (streams, shorts, comments). This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
                <PublicWalletButton 
                  walletAddress={profile.public_wallet_address} 
                  username={profile.username}
                />
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
                {profile.promotional_link && (
                  <Button variant="default" className="gap-2" asChild>
                    <a href={profile.promotional_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      {profile.promotional_link_text || 'Check this out!'}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div ref={tabsScrollRef} className="relative -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory touch-pan-x">
            <TabsList className="inline-flex gap-2 p-1">
              <TabsTrigger value="streams" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                Streams {streams.length > 0 && `(${streams.length})`}
              </TabsTrigger>
              <TabsTrigger value="videos" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                Videos {videos.length > 0 && `(${videos.length})`}
              </TabsTrigger>
              <TabsTrigger value="shorts" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                Shorts {shorts.length > 0 && `(${shorts.length})`}
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="analytics" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                  Analytics
                </TabsTrigger>
              )}
              <TabsTrigger value="about" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                About
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="settings" className="snap-start first:ml-0 last:mr-0 text-xs md:text-sm whitespace-nowrap flex-shrink-0 min-w-max px-4 md:px-6">
                  Settings
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="streams" className="mt-6">
            {isLoadingStreams ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonStreamCard key={i} />
                ))}
              </div>
            ) : streams.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No streams yet"
                description={isOwnProfile ? "Start streaming to share your content with the world!" : `${profile.display_name || profile.username} hasn't streamed yet.`}
                action={isOwnProfile ? {
                  label: "Start Streaming",
                  onClick: () => navigate('/submit')
                } : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.map((stream) => (
                  <StreamCard key={stream.id} stream={stream as any} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            {isLoadingVideos ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonVideoCard key={i} />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No videos yet"
                description={isOwnProfile ? "Upload your first video to get started!" : `${profile.display_name || profile.username} hasn't uploaded any videos yet.`}
                action={isOwnProfile ? {
                  label: "Upload Video",
                  onClick: () => navigate('/submit')
                } : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <WutchVideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="shorts" className="mt-6">
            {isLoadingShorts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonShortCard key={i} />
                ))}
              </div>
            ) : shorts.length === 0 ? (
              <EmptyState
                icon={Film}
                title="No shorts yet"
                description={isOwnProfile ? "Create short-form content to engage your audience!" : `${profile.display_name || profile.username} hasn't posted any shorts yet.`}
                action={isOwnProfile ? {
                  label: "Create Short",
                  onClick: () => navigate('/submit')
                } : undefined}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {shorts.map((short) => (
                  <ShortCard 
                    key={short.id} 
                    short={short as any}
                    onClick={() => navigate('/shorts')}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="analytics" className="mt-6">
              <ProfileAnalytics userId={profile.id} />
            </TabsContent>
          )}

          <TabsContent value="about" className="mt-6 space-y-6">
            {/* Bio Section */}
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                About
              </h3>
              {profile.bio ? (
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-muted-foreground italic">
                  {isOwnProfile ? 'Add a bio to tell people about yourself' : 'No bio added yet'}
                </p>
              )}
            </Card>

            {/* Account Information */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Profile Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="font-medium">
                    {format(new Date(profile.created_at), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Followers</span>
                  <span className="font-medium">{profile.follower_count || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Verification Status</span>
                  <Badge variant={profile.is_verified ? 'default' : 'secondary'} className="gap-1">
                    {profile.is_verified && <CheckCircle2 className="h-3 w-3" />}
                    {profile.is_verified ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Social Links */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Social Links
              </h3>
              {(socialLinks.twitter || socialLinks.discord || socialLinks.website) ? (
                <div className="space-y-3">
                  {socialLinks.twitter && (
                    <a
                      href={socialLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors group"
                    >
                      <Twitter className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="flex-1 text-sm font-medium">Twitter</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                  {socialLinks.discord && (
                    <a
                      href={socialLinks.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors group"
                    >
                      <span className="h-5 w-5 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors font-bold text-lg">D</span>
                      <span className="flex-1 text-sm font-medium">Discord</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                  {socialLinks.website && (
                    <a
                      href={socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors group"
                    >
                      <Globe className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="flex-1 text-sm font-medium">Website</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">
                  {isOwnProfile ? 'Add social links in Edit Profile' : 'No social links added'}
                </p>
              )}
            </Card>

            {/* Public Wallet / Donation Section */}
            {profile.public_wallet_address && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Support this Creator
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send SOL donations directly to @{profile.username}
                </p>
                <PublicWalletButton 
                  walletAddress={profile.public_wallet_address}
                  username={profile.username}
                />
              </Card>
            )}

            {/* Promotional Link */}
            {profile.promotional_link && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  Featured Link
                </h3>
                <a
                  href={profile.promotional_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors group border border-primary/20"
                >
                  <div className="flex-1">
                    <p className="font-medium text-primary">
                      {profile.promotional_link_text || 'Check this out!'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {profile.promotional_link}
                    </p>
                  </div>
                  <ExternalLink className="h-5 w-5 text-primary shrink-0" />
                </a>
              </Card>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="settings" className="mt-6 space-y-6">
              <Card className="p-6 space-y-6">
                {/* 2FA Section */}
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

                {/* Wallet Section */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Wallet Management
                  </h3>
                  <ProfileWalletDisplay userId={profile.id} />
                </div>

                {/* Donation Settings */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                    Donation Settings
                  </h3>
                  <DonationSettings />
                </div>

                {/* Verification Section */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Verification
                  </h3>
                  <div className="p-4 bg-muted rounded-lg">
                    {profile.verification_type && profile.verification_type !== 'none' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Verified Account</p>
                          <VerificationBadge verificationType={profile.verification_type as any} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {profile.verification_type === 'blue' 
                            ? 'Your identity has been verified'
                            : 'You earned this badge through engagement and hard work'}
                        </p>
                        {profile.verified_at && (
                          <p className="text-xs text-muted-foreground">
                            Verified on {format(new Date(profile.verified_at), 'MMMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Get verified to build trust with your audience
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setVerificationType('blue');
                              setVerificationDialogOpen(true);
                            }}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Request Blue Badge
                          </Button>
                          <Button
                            onClick={() => {
                              setVerificationType('red');
                              setVerificationDialogOpen(true);
                            }}
                            variant="outline"
                            className="flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Request Red Badge
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Message Coming Soon Dialog */}
      <AlertDialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Messaging Coming Soon</AlertDialogTitle>
            <AlertDialogDescription>
              Direct messaging feature is currently under development and will be available soon!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        imageUrl={viewingImage?.url || null}
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        alt={viewingImage?.alt}
      />

      <VerificationRequestDialog
        open={verificationDialogOpen}
        onOpenChange={setVerificationDialogOpen}
        verificationType={verificationType}
      />
    </div>
  );
};

export default ProfilePage;
