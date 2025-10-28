import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { X402PaymentModal } from '@/components/X402PaymentModal';
import { WutchVideoPlayer } from '@/components/WutchVideoPlayer';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import { WutchVideoCardCompact } from '@/components/WutchVideoCardCompact';
import { ShortCard } from '@/components/ShortCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThumbsUp, Share2, ExternalLink, Eye, Lock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CommentsSection from '@/components/CommentsSection';
import { useToast } from '@/hooks/use-toast';
import { parseContentUrl, generateContentUrl } from '@/utils/urlHelpers';
import { CreateSharingCampaign } from '@/components/CreateSharingCampaign';
import { ShareAndEarn } from '@/components/ShareAndEarn';
import { shareWutchVideoToTwitter } from '@/utils/shareUtils';
import { makeAbsoluteUrl } from '@/utils/appUrl';

const WutchVideoDetail = () => {
  const params = useParams<{ id: string }>();
  // Handle both new SEO format and legacy UUID-only format
  // Fallback: Extract UUID from URL pathname if parseContentUrl fails
  let id = params.id || parseContentUrl(window.location.pathname);
  
  // Final fallback: Extract UUID from pathname directly
  if (!id) {
    const pathParts = window.location.pathname.split('/');
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    id = pathParts.find(part => uuidPattern.test(part)) || '';
  }
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [video, setVideo] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [channelVideos, setChannelVideos] = useState<any[]>([]);
  const [relatedShorts, setRelatedShorts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [watchTime, setWatchTime] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [creatorWallet, setCreatorWallet] = useState<string>('');

  const { 
    hasAccess, 
    isPremium, 
    isOwner, 
    price, 
    asset, 
    network, 
    isLoading: isCheckingAccess,
    checkAccess 
  } = usePremiumAccess({
    contentType: 'wutch_video',
    contentId: id || '',
  });

  useEffect(() => {
    if (id) {
      fetchVideo();
      incrementViews();
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      checkLikeStatus();
    }
  }, [user, id]);

  const fetchVideo = async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    try {
      const { data: videoData, error } = await supabase
        .from('wutch_videos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching video:', error);
        setIsLoading(false);
        return;
      }
      setVideo(videoData);
      setLikeCount(videoData.like_count || 0);

      // Fetch creator profile using public view (hides financial data)
      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', videoData.user_id)
        .single();

      setCreator(profileData);

      // Fetch creator wallet if premium content
      if (videoData.is_premium) {
        const { data: walletData } = await supabase
          .from('profile_wallets')
          .select('wallet_address')
          .eq('user_id', videoData.user_id)
          .maybeSingle();
        
        if (walletData?.wallet_address) {
          setCreatorWallet(walletData.wallet_address);
        }
      }

      // Fetch videos from the same channel
      const { data: channelData } = await supabase
        .from('wutch_videos')
        .select('*')
        .eq('user_id', videoData.user_id)
        .neq('id', id)
        .eq('status', 'published')
        .limit(10);

      if (channelData) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', videoData.user_id);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const videosWithProfiles = channelData.map((v: any) => ({
          ...v,
          profiles: profilesMap.get(v.user_id),
        }));
        
        setChannelVideos(videosWithProfiles);
      }

      // Fetch related videos (same category)
      let { data: relatedData } = await supabase
        .from('wutch_videos')
        .select('*')
        .neq('id', id)
        .eq('status', 'published')
        .eq('category', videoData.category || '')
        .limit(10);

      // Fallback: If no category-specific videos found, fetch popular suggested videos
      if (!relatedData || relatedData.length === 0) {
        const { data: suggestedData } = await supabase
          .from('wutch_videos')
          .select('*')
          .neq('id', id)
          .neq('user_id', videoData.user_id)
          .eq('status', 'published')
          .order('view_count', { ascending: false })
          .limit(10);
        
        relatedData = suggestedData;
      }

      if (relatedData) {
        const userIds = [...new Set(relatedData.map((v: any) => v.user_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const videosWithProfiles = relatedData.map((v: any) => ({
          ...v,
          profiles: profilesMap.get(v.user_id),
        }));
        
        setRelatedVideos(videosWithProfiles);
      }

      // Fetch related shorts
      const { data: shortsData } = await supabase
        .from('short_videos')
        .select('*')
        .limit(6);

      if (shortsData) {
        const userIds = [...new Set(shortsData.map((s: any) => s.user_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const shortsWithProfiles = shortsData.map((s: any) => ({
          ...s,
          profiles: profilesMap.get(s.user_id),
        }));
        
        setRelatedShorts(shortsWithProfiles);
      }

      document.title = `${videoData.title} | Wutch`;
    } catch (error) {
      console.error('Error fetching video:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const incrementViews = async () => {
    if (!id) return;
    try {
      await supabase.rpc('increment_wutch_video_views', { video_id: id });
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  const checkLikeStatus = async () => {
    if (!user || !id) return;
    
    const { data } = await supabase
      .from('wutch_video_likes')
      .select('*')
      .eq('wutch_video_id', id)
      .eq('user_id', user.id)
      .single();

    setIsLiked(!!data);
  };

  const toggleLike = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like videos',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('wutch_video_likes')
          .delete()
          .eq('wutch_video_id', id)
          .eq('user_id', user.id);
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        await supabase
          .from('wutch_video_likes')
          .insert({ wutch_video_id: id, user_id: user.id });
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video?.title,
        url: window.location.href,
      });
    } catch (error) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Link copied',
        description: 'Video link copied to clipboard',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <div className="max-w-screen-2xl mx-auto p-4 md:p-6">
          <div className="grid lg:grid-cols-[1fr_400px] gap-6">
            <div className="space-y-6">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-6 w-40" />
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Video not found</p>
      </div>
    );
  }

  const isVideoOwner = user && video.user_id === user.id;
  const videoUrl = makeAbsoluteUrl(generateContentUrl('wutch', { 
    id: video.id, 
    title: video.title, 
    profiles: creator ? { username: creator.username } : undefined 
  }));

  // Show paywall if premium and no access
  const showPaywall = isPremium && !hasAccess && !isOwner;

  return (
    <div className="min-h-screen pb-20 lg:pb-6 bg-background">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Video Player & Info */}
          <div className="space-y-4">
            {/* Video Player with Paywall Overlay */}
            <div className="relative">
              {isCheckingAccess ? (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : showPaywall ? (
                <div className="aspect-video bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg flex flex-col items-center justify-center p-6 border border-purple-500/20">
                  <Lock className="h-16 w-16 text-purple-500 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Premium Content</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Unlock this video for {price} {asset}
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
              ) : (
                <WutchVideoPlayer 
                  videoUrl={video.video_url} 
                  videoId={video.id}
                  thumbnailUrl={video.thumbnail_url}
                  onTimeUpdate={(time) => setWatchTime(time)}
                  className="aspect-video"
                  hasAccess={true}
                />
              )}
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl font-bold">{video.title}</h1>

              {/* Creator Info Bar */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={creator?.avatar_url} />
                    <AvatarFallback>
                      {creator?.display_name?.[0] || creator?.username?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link 
                      to={`/profile/${creator?.username}`}
                      className="font-semibold hover:text-primary transition-colors"
                    >
                      {creator?.display_name || creator?.username}
                    </Link>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>{video.view_count.toLocaleString()} views</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={isLiked ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleLike}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    {likeCount}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      if (creator) {
                        shareWutchVideoToTwitter({
                          id: video.id,
                          title: video.title,
                          creatorName: creator.display_name || creator.username,
                          username: creator.username,
                        });
                        toast({
                          title: "Opening Twitter",
                          description: "Share this video with your followers!",
                        });
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>

                  {/* Share campaign - Owner can create, viewers can earn */}
                  {isVideoOwner && (
                    <CreateSharingCampaign 
                      contentId={video.id}
                      contentType="wutch_video"
                      contentTitle={video.title}
                    />
                  )}
                  
                  {!isVideoOwner && (
                    <ShareAndEarn 
                      contentId={video.id}
                      contentType="wutch_video"
                      contentTitle={video.title}
                      contentUrl={videoUrl}
                    />
                  )}
                </div>
              </div>

              {/* Premium Badge */}
              {isPremium && (
                <Badge variant="secondary" className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-purple-600/20">
                  <Lock className="h-3 w-3 mr-1 text-purple-600" />
                  Premium Content
                </Badge>
              )}

              {/* Description & Category */}
              {video.description && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{video.description}</p>
                  {video.category && (
                    <Badge variant="secondary" className="mt-2">
                      {video.category}
                    </Badge>
                  )}
                </div>
              )}

              {/* Promotional Link */}
              {video.promotional_link && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={video.promotional_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {video.promotional_link_text || 'Check this out!'}
                  </a>
                </Button>
              )}

              {/* Comments */}
              <CommentsSection contentId={video.id} contentType="wutch_video" />
            </div>
          </div>

          {/* Right: Related Content */}
          <div className="space-y-4">
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-muted/50">
                <TabsTrigger value="all" className="data-[state=active]:bg-background">All</TabsTrigger>
                <TabsTrigger value="channel" className="data-[state=active]:bg-background">From Channel</TabsTrigger>
                <TabsTrigger value="related" className="data-[state=active]:bg-background">Related</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-3 mt-4">
                {/* Shorts Section */}
                {relatedShorts.length > 0 && (
                  <div className="space-y-3 pb-4 border-b border-border">
                    <h3 className="font-semibold text-sm px-2">Shorts</h3>
                    <Carousel className="w-full">
                      <CarouselContent className="-ml-2">
                        {relatedShorts.map((short) => (
                          <CarouselItem key={short.id} className="basis-1/2 pl-2">
                            <ShortCard short={short} />
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  </div>
                )}

                {/* Related Videos */}
                <div className="space-y-2">
                  {relatedVideos.length > 0 ? (
                    relatedVideos.map((video) => (
                      <WutchVideoCardCompact key={video.id} video={video} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No related videos found
                    </p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="channel" className="space-y-2 mt-4">
                {channelVideos.length > 0 ? (
                  channelVideos.map((video) => (
                    <WutchVideoCardCompact key={video.id} video={video} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No other videos from this channel
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="related" className="space-y-2 mt-4">
                {relatedVideos.length > 0 ? (
                  relatedVideos.map((video) => (
                    <WutchVideoCardCompact key={video.id} video={video} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No related videos found
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && video && creator && creatorWallet && (
        <X402PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          contentType="wutch_video"
          contentId={video.id}
          contentTitle={video.title}
          creatorName={creator.display_name || creator.username}
          price={price || 0}
          creatorWallet={creatorWallet}
          onSuccess={() => {
            checkAccess();
            setShowPaymentModal(false);
          }}
        />
      )}
    </div>
  );
};

export default WutchVideoDetail;
