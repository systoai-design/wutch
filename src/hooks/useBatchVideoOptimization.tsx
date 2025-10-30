import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { optimizeVideoForWeb } from '@/utils/videoOptimization';

interface OptimizationStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  totalSavings: number;
}

interface VideoToOptimize {
  queue_id: string;
  video_id: string;
  video_url: string;
  title: string;
  current_size: number;
}

export const useBatchVideoOptimization = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<OptimizationStats | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoToOptimize | null>(null);
  const [progress, setProgress] = useState(0);
  const stopRef = useRef(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-optimize-videos', {
        body: { action: 'get_queue_status' }
      });

      if (error) throw error;
      
      if (data?.success && data?.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching optimization stats:', error);
    }
  }, []);

  const populateQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-optimize-videos', {
        body: { action: 'populate_queue' }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message);
        await fetchStats();
        return data.count;
      }
    } catch (error: any) {
      console.error('Error populating queue:', error);
      toast.error('Failed to populate optimization queue');
      throw error;
    }
  }, [fetchStats]);

  const processNextVideo = useCallback(async (): Promise<boolean> => {
    try {
      // Get next video
      const { data: nextData, error: nextError } = await supabase.functions.invoke('batch-optimize-videos', {
        body: { action: 'get_next_video' }
      });

      if (nextError) throw nextError;

      if (!nextData?.video) {
        console.log('No more videos to optimize');
        return false; // No more videos
      }

      const video: VideoToOptimize = nextData.video;
      setCurrentVideo(video);

      console.log(`Optimizing video: ${video.title}`);

      // Download video
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      const file = new File([blob], `${video.title}.mp4`, { type: 'video/mp4' });

      const startTime = Date.now();

      // Optimize video
      const optimizedFile = await optimizeVideoForWeb(file, {
        onProgress: (percent) => setProgress(percent)
      });

      const processingTime = Date.now() - startTime;

      // Upload optimized video
      const timestamp = Date.now();
      const fileName = `${timestamp}-${video.title.replace(/[^a-zA-Z0-9]/g, '')}.mp4`;
      const filePath = `${video.video_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('wutch-videos')
        .upload(filePath, optimizedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('wutch-videos')
        .getPublicUrl(filePath);

      // Mark as complete
      const { error: completeError } = await supabase.functions.invoke('batch-optimize-videos', {
        body: {
          action: 'mark_complete',
          queueId: video.queue_id,
          optimizedUrl: urlData.publicUrl,
          originalSize: video.current_size,
          optimizedSize: optimizedFile.size,
          processingTimeMs: processingTime
        }
      });

      if (completeError) throw completeError;

      const savings = video.current_size - optimizedFile.size;
      const savingsMB = (savings / (1024 * 1024)).toFixed(2);
      
      toast.success(`Optimized "${video.title}" - Saved ${savingsMB} MB`);
      
      await fetchStats();
      return true; // More videos available

    } catch (error: any) {
      console.error('Error processing video:', error);
      
      if (currentVideo) {
        // Mark as failed
        await supabase.functions.invoke('batch-optimize-videos', {
          body: {
            action: 'mark_failed',
            queueId: currentVideo.queue_id,
            errorMessage: error.message
          }
        });
      }

      toast.error(`Failed to optimize video: ${error.message}`);
      return true; // Continue with next video
    }
  }, [currentVideo, fetchStats]);

  const startBatchOptimization = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    stopRef.current = false;
    
    toast.info('Starting batch video optimization...');

    try {
      let hasMore = true;
      while (hasMore && !stopRef.current) {
        hasMore = await processNextVideo();
        
        if (hasMore && !stopRef.current) {
          // Brief pause between videos
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (stopRef.current) {
        toast.info('Batch optimization stopped by user');
      } else {
        toast.success('All videos have been optimized!');
      }
    } catch (error) {
      console.error('Error in batch optimization:', error);
      toast.error('Batch optimization encountered an error');
    } finally {
      setIsRunning(false);
      setCurrentVideo(null);
      setProgress(0);
      await fetchStats();
    }
  }, [isRunning, processNextVideo, fetchStats]);

  const stopBatchOptimization = useCallback(() => {
    stopRef.current = true;
    toast.info('Stopping batch optimization after current video...');
  }, []);

  return {
    isRunning,
    stats,
    currentVideo,
    progress,
    fetchStats,
    populateQueue,
    startBatchOptimization,
    stopBatchOptimization
  };
};
