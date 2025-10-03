-- Update search_path for existing functions to fix security warnings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET follower_count = follower_count + 1 
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET follower_count = GREATEST(0, follower_count - 1) 
    WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.short_videos 
    SET like_count = like_count + 1 
    WHERE id = NEW.short_video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.short_videos 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.short_video_id;
  END IF;
  RETURN NULL;
END;
$$;