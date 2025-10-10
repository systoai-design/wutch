-- Create content moderation table
CREATE TABLE IF NOT EXISTS public.content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('wutch_video', 'short_video', 'livestream_thumbnail')),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderation_labels JSONB,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Add moderation columns to existing tables
ALTER TABLE public.wutch_videos 
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_id UUID REFERENCES public.content_moderation(id);

ALTER TABLE public.short_videos 
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_id UUID REFERENCES public.content_moderation(id);

ALTER TABLE public.livestreams
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_id UUID REFERENCES public.content_moderation(id);

-- Enable RLS
ALTER TABLE public.content_moderation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_moderation
CREATE POLICY "Admins can view all moderation records"
ON public.content_moderation FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own moderation records"
ON public.content_moderation FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert moderation records"
ON public.content_moderation FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update moderation records"
ON public.content_moderation FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update existing RLS policies to check moderation_status
DROP POLICY IF EXISTS "Videos viewable by everyone" ON public.wutch_videos;
CREATE POLICY "Videos viewable by everyone"
ON public.wutch_videos FOR SELECT
USING (moderation_status = 'approved' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Short videos are viewable by everyone" ON public.short_videos;
CREATE POLICY "Short videos are viewable by everyone"
ON public.short_videos FOR SELECT
USING (moderation_status = 'approved' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Livestreams are viewable by everyone" ON public.livestreams;
CREATE POLICY "Livestreams are viewable by everyone"
ON public.livestreams FOR SELECT
USING (moderation_status = 'approved' OR auth.uid() = user_id);

-- Create moderation queue view for admins
CREATE OR REPLACE VIEW public.moderation_queue AS
SELECT 
  cm.id,
  cm.content_type,
  cm.content_id,
  cm.user_id,
  cm.status,
  cm.moderation_labels,
  cm.rejection_reason,
  cm.created_at,
  p.username,
  p.display_name,
  p.avatar_url,
  CASE 
    WHEN cm.content_type = 'wutch_video' THEN wv.video_url
    WHEN cm.content_type = 'short_video' THEN sv.video_url
    WHEN cm.content_type = 'livestream_thumbnail' THEN ls.thumbnail_url
  END as content_url,
  CASE 
    WHEN cm.content_type = 'wutch_video' THEN wv.title
    WHEN cm.content_type = 'short_video' THEN sv.title
    WHEN cm.content_type = 'livestream_thumbnail' THEN ls.title
  END as content_title
FROM public.content_moderation cm
LEFT JOIN public.profiles p ON p.id = cm.user_id
LEFT JOIN public.wutch_videos wv ON cm.content_type = 'wutch_video' AND cm.content_id = wv.id
LEFT JOIN public.short_videos sv ON cm.content_type = 'short_video' AND cm.content_id = sv.id
LEFT JOIN public.livestreams ls ON cm.content_type = 'livestream_thumbnail' AND cm.content_id = ls.id
WHERE cm.status = 'pending'
ORDER BY cm.created_at ASC;