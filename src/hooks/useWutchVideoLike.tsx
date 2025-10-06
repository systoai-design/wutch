import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export const useWutchVideoLike = (videoId: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkLikeStatus();
    }
    fetchLikeCount();
  }, [user, videoId]);

  const checkLikeStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('wutch_video_likes')
        .select('*')
        .eq('wutch_video_id', videoId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const fetchLikeCount = async () => {
    try {
      const { data } = await supabase
        .from('wutch_videos')
        .select('like_count')
        .eq('id', videoId)
        .single();

      if (data) {
        setLikeCount(data.like_count || 0);
      }
    } catch (error) {
      console.error('Error fetching like count:', error);
    }
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

    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isLiked) {
        await supabase
          .from('wutch_video_likes')
          .delete()
          .eq('wutch_video_id', videoId)
          .eq('user_id', user.id);

        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('wutch_video_likes')
          .insert({
            wutch_video_id: videoId,
            user_id: user.id,
          });

        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLiked, likeCount, toggleLike, isLoading };
};
