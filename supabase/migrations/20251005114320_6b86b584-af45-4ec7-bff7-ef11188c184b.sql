-- Create livestream_likes table
CREATE TABLE public.livestream_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  livestream_id UUID NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, livestream_id)
);

-- Enable RLS
ALTER TABLE public.livestream_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Likes are viewable by everyone"
  ON public.livestream_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like streams"
  ON public.livestream_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike streams"
  ON public.livestream_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add like_count column to livestreams table
ALTER TABLE public.livestreams 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Create function to update like count
CREATE OR REPLACE FUNCTION public.update_stream_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.livestreams 
    SET like_count = like_count + 1 
    WHERE id = NEW.livestream_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.livestreams 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.livestream_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for like count updates
CREATE TRIGGER update_stream_like_count_trigger
  AFTER INSERT OR DELETE ON public.livestream_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stream_like_count();