-- Create video optimization tracking tables
CREATE TABLE IF NOT EXISTS public.video_optimization_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.wutch_videos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(video_id)
);

CREATE TABLE IF NOT EXISTS public.video_optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.wutch_videos(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES public.video_optimization_queue(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'downloading', 'optimizing', 'uploading', 'completed', 'failed')),
  original_size BIGINT,
  optimized_size BIGINT,
  original_duration INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_optimization_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_optimization_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin/Moderator only
CREATE POLICY "Admins can view optimization queue"
  ON public.video_optimization_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admins can manage optimization queue"
  ON public.video_optimization_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view optimization logs"
  ON public.video_optimization_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "System can insert optimization logs"
  ON public.video_optimization_log FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_video_optimization_queue_status ON public.video_optimization_queue(status);
CREATE INDEX idx_video_optimization_queue_video_id ON public.video_optimization_queue(video_id);
CREATE INDEX idx_video_optimization_log_video_id ON public.video_optimization_log(video_id);
CREATE INDEX idx_video_optimization_log_queue_id ON public.video_optimization_log(queue_id);

-- Function to populate optimization queue with unoptimized videos
CREATE OR REPLACE FUNCTION public.populate_video_optimization_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Only admins can populate the queue
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  -- Insert videos that need optimization (pending transcoding or no HLS)
  INSERT INTO public.video_optimization_queue (video_id, priority)
  SELECT 
    wv.id,
    CASE 
      WHEN wv.view_count > 1000 THEN 3  -- High priority for popular videos
      WHEN wv.view_count > 100 THEN 2   -- Medium priority
      ELSE 1                             -- Normal priority
    END as priority
  FROM public.wutch_videos wv
  WHERE wv.is_published = true
    AND (
      wv.transcoding_status = 'pending'
      OR wv.transcoding_status = 'failed'
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
$$;

-- Function to get next video to optimize
CREATE OR REPLACE FUNCTION public.get_next_video_to_optimize()
RETURNS TABLE (
  queue_id UUID,
  video_id UUID,
  video_url TEXT,
  title TEXT,
  current_size BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Return video details
  RETURN QUERY
  SELECT 
    voq.id,
    wv.id,
    wv.video_url,
    wv.title,
    wv.file_size
  FROM public.video_optimization_queue voq
  JOIN public.wutch_videos wv ON wv.id = voq.video_id
  WHERE voq.id = selected_queue_id;
END;
$$;

-- Function to mark optimization complete
CREATE OR REPLACE FUNCTION public.mark_video_optimization_complete(
  p_queue_id UUID,
  p_optimized_url TEXT,
  p_original_size BIGINT,
  p_optimized_size BIGINT,
  p_processing_time_ms INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Update video record
  UPDATE public.wutch_videos
  SET video_url = p_optimized_url,
      file_size = p_optimized_size,
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
$$;

-- Function to mark optimization failed
CREATE OR REPLACE FUNCTION public.mark_video_optimization_failed(
  p_queue_id UUID,
  p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video_id UUID;
  v_retry_count INTEGER;
  v_max_retries INTEGER;
BEGIN
  -- Get video details
  SELECT video_id, retry_count, max_retries
  INTO v_video_id, v_retry_count, v_max_retries
  FROM public.video_optimization_queue
  WHERE id = p_queue_id;
  
  -- Increment retry count
  UPDATE public.video_optimization_queue
  SET retry_count = retry_count + 1,
      status = CASE 
        WHEN retry_count + 1 >= max_retries THEN 'failed'
        ELSE 'pending'
      END
  WHERE id = p_queue_id;
  
  -- Log failure
  INSERT INTO public.video_optimization_log (
    video_id,
    queue_id,
    status,
    error_message
  ) VALUES (
    v_video_id,
    p_queue_id,
    'failed',
    p_error_message
  );
END;
$$;