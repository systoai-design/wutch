import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Heart, Share2, Timer, AlertCircle, ExternalLink, Lock, Loader2 } from 'lucide-react';
import StreamCard from '@/components/StreamCard';
import WatchTimeIndicator from '@/components/WatchTimeIndicator';
import ClaimBounty from '@/components/ClaimBounty';
import CommentsSection from '@/components/CommentsSection';
import { EditStreamDialog } from '@/components/EditStreamDialog';
import { CreateSharingCampaign } from '@/components/CreateSharingCampaign';
import { ShareAndEarn } from '@/components/ShareAndEarn';
import GuestPromptDialog from '@/components/GuestPromptDialog';
import { PumpFunPlayer } from '@/components/PumpFunPlayer';
import { X402PaymentModal } from '@/components/X402PaymentModal';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useViewingSession } from '@/hooks/useViewingSession';
import { useStreamLike } from '@/hooks/useStreamLike';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { shareStreamToTwitter } from '@/utils/shareUtils';
import { parseContentUrl, generateContentUrl } from '@/utils/urlHelpers';
import { makeAbsoluteUrl } from '@/utils/appUrl';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { VerificationBadge } from '@/components/VerificationBadge';
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

type Livestream = Database['public']['Tables']['livestreams']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type PublicProfile = Omit<Profile, 'total_earnings' | 'pending_earnings' | 'total_donations_received' | 'last_payout_at' | 'updated_at'> & {
  verification_type?: string | null;
  verified_at?: string | null;
};

const StreamDetail = () => {
  const params = useParams();
  // Handle both new SEO format and legacy UUID-only format
  const id = params.id || parseContentUrl(window.location.pathname);
  const { user, isGuest } = useAuth();
  const { isAdmin } = useAdmin();
  const isMobile = useIsMobile();
  const [stream, setStream] = useState<Livestream | null>(null);
  const [streamer, setStreamer] = useState<PublicProfile | null>(null);
  const [relatedStreams, setRelatedStreams] = useState<Livestream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptAction, setGuestPromptAction] = useState<'like' | 'donate'>('like');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [creatorWallet, setCreatorWallet] = useState<string>('');
  const { isAdmin: isStreamerAdmin, isModerator: isStreamerModerator } = useUserRoles(stream?.user_id);

  const { 
    hasAccess, 
    isPremium, 
    isOwner: isPremiumOwner, 
    price, 
    asset, 
    network, 
    isLoading: isCheckingAccess,
    checkAccess 
  } = usePremiumAccess({
    contentType: 'livestream',
    contentId: id || '',
  });

  // Track viewing session
  const { 
    watchTime, 
    formattedWatchTime, 
    isTabVisible, 
    meetsMinimumWatchTime,
    isSessionStarted,
    isTracking
  } = useViewingSession({ 
    livestreamId: id || '',
    shouldStart: hasStartedWatching,
    onTimerStart: () => {
      toast.success('Timer Started!', {
        description: 'Watch time tracking active! Keep this tab open to earn rewards.',
        duration: 5000,
      });
    }
  });

  // Track stream likes
  const { isLiked, likeCount, toggleLike, setLikeCount, showGuestDialog, setShowGuestDialog } = useStreamLike(id || '');

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
        
        // Update like count from stream data
        if (streamData.like_count !== undefined) {
          setLikeCount(streamData.like_count);
        }

        // Fetch creator wallet if premium content
        if (streamData.is_premium) {
          const { data: walletData } = await supabase
            .from('profile_wallets')
            .select('wallet_address')
            .eq('user_id', streamData.user_id)
            .maybeSingle();
          
          if (walletData?.wallet_address) {
            setCreatorWallet(walletData.wallet_address);
          }
        }

        // Fetch streamer profile (public fields only via view)
        const { data: streamerData } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, follower_count, social_links, is_verified, banner_url, bio, created_at, promotional_link, promotional_link_text, public_wallet_address, verification_type, verified_at')
          .eq('id', streamData.user_id)
          .maybeSingle();

        if (streamerData) {
          setStreamer(streamerData as PublicProfile);
        }

        // Fetch related streams
        const { data: relatedData } = await supabase
          .from('livestreams')
          .select(`
            *,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          `)
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

  // Track viewer count
  useEffect(() => {
    if (!id || !user) return;

    const incrementViewer = async () => {
      await supabase.rpc('increment_stream_viewers', { stream_id: id });
    };

    const decrementViewer = async () => {
      await supabase.rpc('decrement_stream_viewers', { stream_id: id });
    };

    incrementViewer();

    return () => {
      decrementViewer();
    };
  }, [id, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stream) {
    return <div className="p-8 text-center">Stream not found</div>;
  }

  const isOwner = user && stream.user_id === user.id;
  const canDelete = isOwner || isAdmin;
  const socialLinks = (streamer?.social_links as { twitter?: string; discord?: string; website?: string }) || {};
  const displayName = streamer?.display_name || streamer?.username || 'Creator';
  const avatarUrl = streamer?.avatar_url || '/placeholder.svg';
  const followerCount = streamer?.follower_count ?? 0;
  const username = streamer?.username || '';
  const showPaywall = stream?.is_premium && isPremium && !hasAccess && !isPremiumOwner;

  const handleDeleteStream = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('livestreams')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Stream deleted successfully');
      window.location.href = '/';
    } catch (error: any) {
      toast.error('Failed to delete stream: ' + error.message);
    }
  };

  return (
    <>
      <GuestPromptDialog
        open={showGuestPrompt}
        onOpenChange={setShowGuestPrompt}
        action={guestPromptAction}
      />
      <div className="min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Video Player with Paywall Overlay */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
            {showPaywall ? (
              <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex flex-col items-center justify-center p-6 border border-purple-500/20">
                <Lock className="h-16 w-16 text-purple-500 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Premium Stream</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Unlock this livestream for {price} {asset}
                </p>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                  One-time payment • Permanent access • {creatorWallet ? '95% goes to creator' : 'Creator receives 95%'}
                </p>
                {creatorWallet ? (
                  <Button 
                    size="lg" 
                    onClick={() => setShowPaymentModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Unlock for {price} SOL
                  </Button>
                ) : (
                  <Alert variant="destructive" className="max-w-md">
                    <AlertDescription>
                      Creator wallet not configured. Cannot purchase at this time.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : isCheckingAccess ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PumpFunPlayer 
                pumpFunUrl={stream.pump_fun_url}
                isLive={stream.is_live || false}
                showExternalLink={true}
                onStreamOpened={() => setHasStartedWatching(true)}
                hasAccess={hasAccess}
              />
            )}
          </div>

          {/* Owner Controls */}
          {isOwner && (
            <div className="flex justify-end">
              <EditStreamDialog stream={stream} onUpdate={fetchStreamData} />
            </div>
          )}

          {/* Stream Info */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1.5 line-clamp-2 sm:line-clamp-none">{stream.title}</h1>
              <div className="flex items-center gap-2 sm:gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1 sm:gap-2 px-2 py-0.5 sm:px-3 sm:py-1.5 bg-primary/10 rounded-full">
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span className="font-semibold text-foreground text-sm">{(stream.viewer_count || 0).toLocaleString()}</span>
                  <span className="text-xs">{isMobile ? '' : 'viewers'}</span>
                </div>
                <span>•</span>
                <span className="text-xs sm:text-sm">{new Date(stream.created_at || '').toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
              {username ? (
                <Link to={`/profile/${username}`} className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
                      {displayName}
                      <UserBadges
                        userId={stream.user_id}
                        verificationType={streamer?.verification_type as 'blue' | 'red' | 'none' | null}
                        isAdmin={isStreamerAdmin}
                        isModerator={isStreamerModerator}
                        size="sm"
                      />
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {followerCount.toLocaleString()} {isMobile ? '' : 'followers'}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm sm:text-base">{displayName}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {followerCount.toLocaleString()} {isMobile ? '' : 'followers'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size={isMobile ? "sm" : "icon"}
                  onClick={() => {
                    if (isGuest) {
                      setGuestPromptAction('like');
                      setShowGuestPrompt(true);
                    } else {
                      toggleLike();
                    }
                  }}
                  className="relative active:scale-95 transition-transform min-h-[44px] min-w-[44px]"
                >
                  <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${isLiked ? 'fill-primary text-primary' : ''}`} />
                  {likeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                      {likeCount}
                    </span>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  size={isMobile ? "sm" : "default"}
                  className="gap-1.5 sm:gap-2 active:scale-95 transition-transform min-h-[44px]"
                  onClick={() => {
                    if (stream && streamer) {
                      shareStreamToTwitter({
                        id: stream.id,
                        title: stream.title,
                        creatorName: streamer.display_name || streamer.username,
                        username: streamer.username,
                      });
                      toast.success('Opening Twitter to share this stream!');
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {!isMobile && 'Share'}
                </Button>

                {/* Share campaign - Owner can create, viewers can earn */}
                {isOwner && stream && (
                  <CreateSharingCampaign 
                    contentId={stream.id}
                    contentType="livestream"
                    contentTitle={stream.title}
                  />
                )}
                
                {!isOwner && stream && (
                  <ShareAndEarn 
                    contentId={stream.id}
                    contentType="livestream"
                    contentTitle={stream.title}
                    contentUrl={makeAbsoluteUrl(generateContentUrl('stream', { id: stream.id, title: stream.title, profiles: streamer ? { username: streamer.username } : undefined }))}
                  />
                )}

                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Stream</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this stream? This action cannot be undone.
                          {isAdmin && !isOwner && " (Admin delete)"}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteStream}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Watch Time Tracker - Show for non-owners */}
            {!isOwner && (
              <>
                {user && isSessionStarted ? (
                  <>
                    <Alert className="border-primary/20 bg-primary/5">
                      <Timer className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Watch time tracking active!</strong> Keep this tab visible and focused to earn rewards.
                      </AlertDescription>
                    </Alert>
                    <WatchTimeIndicator
                      watchTime={watchTime}
                      formattedWatchTime={formattedWatchTime}
                      isTracking={isTracking}
                      meetsMinimumWatchTime={meetsMinimumWatchTime}
                    />
                  </>
                ) : isGuest ? (
                  <Alert className="border-primary/20 bg-primary/5">
                    <Timer className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Sign in to track watch time</strong> and earn rewards while watching!
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            )}

            {/* Bounty Claim - Show for all non-owners */}
            {!isOwner && (
              <ClaimBounty
                livestreamId={id!}
                watchTime={watchTime}
                meetsMinimumWatchTime={meetsMinimumWatchTime}
                streamTitle={stream.title}
                creatorName={streamer?.display_name || streamer?.username || 'Creator'}
              />
            )}

            <Card className="p-3 sm:p-4">
              <Tabs defaultValue="description">
                <TabsList>
                  <TabsTrigger value="description" className="text-xs sm:text-sm">Description</TabsTrigger>
                  <TabsTrigger value="chat" className="text-xs sm:text-sm">Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="description" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
                  <p className="text-foreground text-sm sm:text-base">{stream.description}</p>
                  
                  {stream.promotional_link && (
                    <Button className="gap-2 w-full" size={isMobile ? "default" : "lg"} asChild>
                      <a href={stream.promotional_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-sm sm:text-base">{stream.promotional_link_text || 'Check this out!'}</span>
                      </a>
                    </Button>
                  )}
                  
                  {stream.tags && stream.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {stream.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="chat" className="mt-3 sm:mt-4 h-[400px] sm:h-[500px]">
                  <CommentsSection
                    contentId={id!}
                    contentType="livestream"
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="font-semibold text-base sm:text-lg">Related Streams</h2>
          <div className="space-y-3 sm:space-y-4">
            {relatedStreams.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">No related streams</p>
            ) : (
              relatedStreams.slice(0, isMobile ? 2 : 4).map((relatedStream) => (
                <StreamCard key={relatedStream.id} stream={relatedStream} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    
    <GuestPromptDialog
      open={showGuestDialog}
      onOpenChange={setShowGuestDialog}
      action="like"
    />

    {/* Payment Modal */}
    {showPaymentModal && stream && streamer && creatorWallet && (
      <X402PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        contentType="livestream"
        contentId={stream.id}
        contentTitle={stream.title}
        creatorName={streamer.display_name || streamer.username}
        price={price || 0}
        creatorWallet={creatorWallet}
        onSuccess={() => {
          checkAccess();
          setShowPaymentModal(false);
        }}
      />
    )}
    </>
  );
};

export default StreamDetail;
