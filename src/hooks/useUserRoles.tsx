import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUserRoles(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setIsModerator(false);
      setIsLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) throw error;

        const roles = data?.map(r => r.role) || [];
        setIsAdmin(roles.includes('admin'));
        setIsModerator(roles.includes('moderator') || roles.includes('admin'));
      } catch (error) {
        console.error('Error fetching user roles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  return { isAdmin, isModerator, isLoading };
}
