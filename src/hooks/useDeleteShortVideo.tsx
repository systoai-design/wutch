import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function useDeleteShortVideo() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteShortVideo = async (shortVideoId: string) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-short-video', {
        body: { shortVideoId },
      });

      if (error) throw error;

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['shorts'] });
      queryClient.invalidateQueries({ queryKey: ['profile-shorts'] });

      toast({
        title: 'Success',
        description: 'Short video deleted successfully',
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting short video:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete short video',
        variant: 'destructive',
      });
      return { success: false, error };
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteShortVideo,
    isDeleting,
  };
}
