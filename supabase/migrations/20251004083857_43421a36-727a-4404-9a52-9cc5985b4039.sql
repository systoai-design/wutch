-- Enable Realtime for comments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Create RPC function to safely increment short video views
CREATE OR REPLACE FUNCTION public.increment_short_video_views(video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.short_videos 
  SET view_count = view_count + 1 
  WHERE id = video_id;
END;
$$;