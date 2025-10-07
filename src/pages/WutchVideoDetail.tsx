import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { WutchVideoPlayer } from '@/components/WutchVideoPlayer';
import { WutchVideoCard } from '@/components/WutchVideoCard';
import { ShortCard } from '@/components/ShortCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbsUp, Share2, ExternalLink, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CommentsSection from '@/components/CommentsSection';
import { useToast } from '@/hooks/use-toast';
import { parseContentUrl } from '@/utils/urlHelpers';

const WutchVideoDetail = () => {
  const params = useParams<{ id: string }>();
  // Handle both new SEO format and legacy UUID-only format
  const id = params.id || parseContentUrl(window.location.pathname);
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
    if (!id) return;
    setIsLoading(true);
    
    try {
      const { data: videoData, error } = await supabase
        .from('wutch_videos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setVideo(videoData);
      setLikeCount(videoData.like_count || 0);

      // Fetch creator profile using public view (hides financial data)
      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', videoData.user_id)
        .single();

      setCreator(profileData);

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
      const { data: relatedData } = await supabase
        .from('wutch_videos')
        .select('*')
        .neq('id', id)
        .eq('status', 'published')
        .eq('category', videoData.category || '')
        .limit(10);

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

  return (
    <div className="min-h-screen pb-20 lg:pb-6 bg-background">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Video Player & Info */}
          <div className="space-y-4">
            <WutchVideoPlayer 
              videoUrl={video.video_url} 
              videoId={video.id}
              thumbnailUrl={video.thumbnail_url}
              onTimeUpdate={(time) => setWatchTime(time)}
              className="aspect-video"
            />

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
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>

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
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="channel">From Channel</TabsTrigger>
                <TabsTrigger value="related">Related</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-4 mt-4">
                {/* Shorts Section */}
                {relatedShorts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Shorts</h3>
                    <Carousel>
                      <CarouselContent>
                        {relatedShorts.map((short) => (
                          <CarouselItem key={short.id} className="basis-1/2">
                            <ShortCard short={short} />
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  </div>
                )}

                {/* Related Videos */}
                {relatedVideos.map((video) => (
                  <WutchVideoCard key={video.id} video={video} className="w-full" />
                ))}
              </TabsContent>
              
              <TabsContent value="channel" className="space-y-4 mt-4">
                {channelVideos.length > 0 ? (
                  channelVideos.map((video) => (
                    <WutchVideoCard key={video.id} video={video} className="w-full" />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No other videos from this channel
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="related" className="space-y-4 mt-4">
                {relatedVideos.length > 0 ? (
                  relatedVideos.map((video) => (
                    <WutchVideoCard key={video.id} video={video} className="w-full" />
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
    </div>
  );
};

export default WutchVideoDetail;
