import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { sortByTrending } from '@/utils/trendingScore';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
  commentCount?: number;
};

export const useShortsQuery = () => {
  return useQuery({
    queryKey: ['shorts'],
    queryFn: async () => {
      const { data: shorts, error } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey (username, display_name, avatar_url, public_wallet_address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch comment counts in bulk
      const shortIds = (shorts || []).map(s => s.id);
      
      const { data: comments } = await supabase
        .from('comments')
        .select('content_id')
        .eq('content_type', 'shortvideo')
        .in('content_id', shortIds);

      const commentCounts: Record<string, number> = {};
      shortIds.forEach(id => commentCounts[id] = 0);
      comments?.forEach(comment => {
        commentCounts[comment.content_id] = (commentCounts[comment.content_id] || 0) + 1;
      });

      const shortsWithComments = (shorts || []).map(short => ({
        ...short,
        commentCount: commentCounts[short.id] || 0,
      })) as ShortVideo[];

      // Sort by trending score
      return sortByTrending(shortsWithComments);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
