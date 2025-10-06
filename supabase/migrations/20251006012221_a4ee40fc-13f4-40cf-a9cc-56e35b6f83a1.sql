-- Phase 1: Database Schema for Wutch Videos

-- Create wutch_videos table for long-form video uploads
CREATE TABLE IF NOT EXISTS public.wutch_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  total_donations NUMERIC DEFAULT 0,
  promotional_link TEXT,
  promotional_link_text TEXT DEFAULT 'Check this out!',
  status TEXT DEFAULT 'published', -- published, processing, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wutch_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wutch_videos
CREATE POLICY "Videos viewable by everyone" 
  ON public.wutch_videos FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert own videos" 
  ON public.wutch_videos FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" 
  ON public.wutch_videos FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" 
  ON public.wutch_videos FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any video" 
  ON public.wutch_videos FOR DELETE 
  USING (has_role(auth.uid(), 'admin'));

-- Create wutch_video_likes table
CREATE TABLE IF NOT EXISTS public.wutch_video_likes (
  wutch_video_id UUID NOT NULL REFERENCES public.wutch_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wutch_video_id, user_id)
);

ALTER TABLE public.wutch_video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are viewable by everyone" 
  ON public.wutch_video_likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can like videos" 
  ON public.wutch_video_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike videos" 
  ON public.wutch_video_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to update wutch video like count
CREATE OR REPLACE FUNCTION public.update_wutch_video_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wutch_videos 
    SET like_count = like_count + 1 
    WHERE id = NEW.wutch_video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wutch_videos 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.wutch_video_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for like count
CREATE TRIGGER update_wutch_video_likes_count
  AFTER INSERT OR DELETE ON public.wutch_video_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wutch_video_like_count();

-- Function to increment wutch video views
CREATE OR REPLACE FUNCTION public.increment_wutch_video_views(video_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wutch_videos 
  SET view_count = view_count + 1 
  WHERE id = video_id;
END;
$$;

-- Update trigger for updated_at column on wutch_videos
CREATE TRIGGER update_wutch_videos_updated_at
  BEFORE UPDATE ON public.wutch_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wutch-videos', 'wutch-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('wutch-video-thumbnails', 'wutch-video-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for wutch-videos bucket
CREATE POLICY "Videos are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'wutch-videos');

CREATE POLICY "Users can upload their own videos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'wutch-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own videos" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'wutch-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own videos" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'wutch-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for wutch-video-thumbnails bucket
CREATE POLICY "Thumbnails are publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'wutch-video-thumbnails');

CREATE POLICY "Users can upload their own thumbnails" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'wutch-video-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own thumbnails" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'wutch-video-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own thumbnails" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'wutch-video-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);