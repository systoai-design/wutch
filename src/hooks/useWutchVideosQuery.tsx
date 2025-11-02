import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { FilterOption } from '@/components/FilterBar';
import { shuffleWithBias, disperseByCreator } from '@/utils/trendingScore';

type WutchVideo = Database['public']['Tables']['wutch_videos']['Row'] & {
  profiles?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
    verification_type?: 'blue' | 'red' | 'none' | null;
    is_verified?: boolean;
  };
  commentCount?: number;
};

const VIDEOS_PER_PAGE = 20;

export const useWutchVideosQuery = (activeFilter: FilterOption = 'all') => {
  return useInfiniteQuery({
    queryKey: ['wutch-videos', activeFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * VIDEOS_PER_PAGE;
      const to = from + VIDEOS_PER_PAGE - 1;
      
      let query = supabase
        .from('wutch_videos')
        .select('*')
        .eq('status', 'published')
        .range(from, to);

      // Apply sorting based on filter
      switch (activeFilter) {
        case 'trending':
          // Will apply trending sort later
          query = query.order('created_at', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch profiles and comments in parallel
      const userIds = [...new Set(data.map(v => v.user_id))];
      const videoIds = data.map(v => v.id);
      
      const [profilesResult, commentsResult] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, verification_type, is_verified')
          .in('id', userIds),
        supabase
          .from('comments')
          .select('content_id')
          .eq('content_type', 'wutch_video')
          .in('content_id', videoIds)
      ]);

      const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);

      const commentCounts: Record<string, number> = {};
      videoIds.forEach(id => commentCounts[id] = 0);
      commentsResult.data?.forEach(comment => {
        commentCounts[comment.content_id] = (commentCounts[comment.content_id] || 0) + 1;
      });

      const videosWithData = data.map(video => ({
        ...video,
        profiles: profilesMap.get(video.user_id),
        commentCount: commentCounts[video.id] || 0,
      })) as WutchVideo[];

      // Apply randomization with quality bias, then disperse by creator
      const shuffled = shuffleWithBias(videosWithData, 0.5);
      return disperseByCreator(shuffled);
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length === VIDEOS_PER_PAGE ? pages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000, // 2 minutes for videos
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
