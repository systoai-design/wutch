import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useModerator() {
  const { user } = useAuth();
  const [isModerator, setIsModerator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkModeratorStatus = async () => {
      if (!user) {
        setIsModerator(false);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'moderator']);

        if (error) throw error;

        const roles = data?.map(r => r.role) || [];
        setIsAdmin(roles.includes('admin'));
        setIsModerator(roles.length > 0);
      } catch (error) {
        console.error('Error checking moderator status:', error);
        setIsModerator(false);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkModeratorStatus();
  }, [user]);

  return { isModerator, isAdmin, isLoading };
}
