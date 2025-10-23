-- Create community_posts table
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'published',
  moderation_status TEXT NOT NULL DEFAULT 'approved'
);

-- Create community_post_likes table
CREATE TABLE public.community_post_likes (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.community_posts FOR SELECT
  USING (moderation_status = 'approved' OR auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON public.community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON public.community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.community_posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and moderators can delete any post"
  ON public.community_posts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- RLS Policies for community_post_likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.community_post_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.community_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.community_post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update post like count
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger for like count
CREATE TRIGGER update_community_post_like_count
  AFTER INSERT OR DELETE ON public.community_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_like_count();

-- Function to notify on post likes
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name TEXT;
  post_content TEXT;
  post_creator UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO liker_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT LEFT(content, 50), user_id INTO post_content, post_creator
  FROM community_posts WHERE id = NEW.post_id;
  
  PERFORM create_notification(
    post_creator,
    'like',
    'New Like ❤️',
    liker_name || ' liked your post',
    NEW.user_id,
    'community_post',
    NEW.post_id,
    jsonb_build_object('post_content', post_content)
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for post like notifications
CREATE TRIGGER notify_community_post_like
  AFTER INSERT ON public.community_post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

-- Update updated_at trigger
CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add community_post to content_type enum (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'content_type' 
    AND e.enumlabel = 'community_post'
  ) THEN
    ALTER TYPE content_type ADD VALUE 'community_post';
  END IF;
END $$;

-- Create storage bucket for community post media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community-posts', 'community-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-posts bucket
CREATE POLICY "Community post images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-posts');

CREATE POLICY "Users can upload community post images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'community-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own community post images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'community-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own community post images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'community-posts' AND auth.uid()::text = (storage.foldername(name))[1]);