import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { FilterOption } from '@/components/FilterBar';

type WutchVideo = Database['public']['Tables']['wutch_videos']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
};

export const useWutchVideosQuery = (activeFilter: FilterOption = 'all') => {
  return useQuery({
    queryKey: ['wutch-videos', activeFilter],
    queryFn: async () => {
      let query = supabase
        .from('wutch_videos')
        .select('*')
        .eq('status', 'published');

      // Apply sorting based on filter
      switch (activeFilter) {
        case 'trending':
          query = query.order('view_count', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(24);

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch profiles in bulk using a more optimized approach
      const userIds = [...new Set(data.map(v => v.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      return data.map(video => ({
        ...video,
        profiles: profilesMap.get(video.user_id),
      })) as WutchVideo[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for videos
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
