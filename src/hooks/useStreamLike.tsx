import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useStreamLike = (livestreamId: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && livestreamId) {
      checkIfLiked();
    }
  }, [user, livestreamId]);

  const checkIfLiked = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('livestream_likes')
        .select('*')
        .eq('user_id', user.id)
        .eq('livestream_id', livestreamId)
        .maybeSingle();

      if (error) throw error;
      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const toggleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like streams');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        // Unlike
        const { error } = await supabase
          .from('livestream_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('livestream_id', livestreamId);

        if (error) throw error;
        toast.success('Removed from liked streams');
      } else {
        // Like
        const { error } = await supabase
          .from('livestream_likes')
          .insert({
            user_id: user.id,
            livestream_id: livestreamId,
          });

        if (error) throw error;
        toast.success('Added to liked streams');
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      toast.error('Failed to update like status');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLiked,
    likeCount,
    toggleLike,
    setLikeCount,
  };
};
