import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export function useFollow(profileUserId: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && profileUserId) {
      checkIfFollowing();
    }
  }, [user, profileUserId]);

  const checkIfFollowing = async () => {
    if (!user || !profileUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', profileUserId)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const toggleFollow = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to follow creators",
        variant: "destructive",
      });
      return;
    }

    if (user.id === profileUserId) {
      toast({
        title: "Cannot follow yourself",
        description: "You cannot follow your own profile",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profileUserId,
          });

        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update follow status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isFollowing, isLoading, toggleFollow };
}
