import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function useDeleteWutchVideo() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteWutchVideo = async (wutchVideoId: string) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-wutch-video', {
        body: { wutchVideoId },
      });

      if (error) throw error;

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['wutch-videos'] });
      queryClient.invalidateQueries({ queryKey: ['profile-videos'] });

      toast({
        title: 'Success',
        description: 'Video deleted successfully',
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting wutch video:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete video',
        variant: 'destructive',
      });
      return { success: false, error };
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteWutchVideo,
    isDeleting,
  };
}
