-- Drop and recreate functions with correct signatures

-- Fix populate_video_optimization_queue to use correct column names
CREATE OR REPLACE FUNCTION public.populate_video_optimization_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Only admins can populate the queue
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  -- Insert videos that need optimization (use status instead of is_published)
  INSERT INTO public.video_optimization_queue (video_id, priority)
  SELECT 
    wv.id,
    CASE 
      WHEN wv.view_count > 1000 THEN 3  -- High priority for popular videos
      WHEN wv.view_count > 100 THEN 2   -- Medium priority
      ELSE 1                             -- Normal priority
    END as priority
  FROM public.wutch_videos wv
  WHERE wv.status = 'published'
    AND (
      wv.transcoding_status IS NULL
      OR wv.transcoding_status IN ('pending', 'failed')
      OR wv.hls_playlist_url IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.video_optimization_queue voq
      WHERE voq.video_id = wv.id
    )
  ON CONFLICT (video_id) DO NOTHING;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$function$;

-- Drop and recreate get_next_video_to_optimize with new signature
DROP FUNCTION IF EXISTS public.get_next_video_to_optimize();

CREATE FUNCTION public.get_next_video_to_optimize()
RETURNS TABLE(queue_id uuid, video_id uuid, user_id uuid, video_url text, title text, current_size bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  selected_queue_id UUID;
BEGIN
  -- Select next pending video by priority
  SELECT voq.id INTO selected_queue_id
  FROM public.video_optimization_queue voq
  WHERE voq.status = 'pending'
    AND voq.retry_count < voq.max_retries
  ORDER BY voq.priority DESC, voq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF selected_queue_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Mark as processing
  UPDATE public.video_optimization_queue
  SET status = 'processing',
      started_at = now()
  WHERE id = selected_queue_id;
  
  -- Return video details with user_id and correct size column
  RETURN QUERY
  SELECT 
    voq.id,
    wv.id,
    wv.user_id,
    wv.video_url,
    wv.title,
    COALESCE(wv.original_file_size, 0) as current_size
  FROM public.video_optimization_queue voq
  JOIN public.wutch_videos wv ON wv.id = voq.video_id
  WHERE voq.id = selected_queue_id;
END;
$function$;

-- Fix mark_video_optimization_complete to use correct column names
CREATE OR REPLACE FUNCTION public.mark_video_optimization_complete(p_queue_id uuid, p_optimized_url text, p_original_size bigint, p_optimized_size bigint, p_processing_time_ms integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_video_id UUID;
BEGIN
  -- Get video_id
  SELECT video_id INTO v_video_id
  FROM public.video_optimization_queue
  WHERE id = p_queue_id;
  
  -- Update queue status
  UPDATE public.video_optimization_queue
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_queue_id;
  
  -- Update video record with correct column name
  UPDATE public.wutch_videos
  SET video_url = p_optimized_url,
      original_file_size = p_optimized_size,
      transcoding_status = 'completed',
      transcoding_completed_at = now()
  WHERE id = v_video_id;
  
  -- Log completion
  INSERT INTO public.video_optimization_log (
    video_id,
    queue_id,
    status,
    original_size,
    optimized_size,
    processing_time_ms
  ) VALUES (
    v_video_id,
    p_queue_id,
    'completed',
    p_original_size,
    p_optimized_size,
    p_processing_time_ms
  );
END;
$function$;

-- Add storage policy for admins to manage wutch-videos bucket
CREATE POLICY "Admins can manage all videos"
ON storage.objects
FOR ALL
USING (bucket_id = 'wutch-videos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'wutch-videos' AND public.has_role(auth.uid(), 'admin'));