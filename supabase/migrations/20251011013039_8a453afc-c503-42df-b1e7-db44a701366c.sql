-- Fix SECURITY DEFINER functions missing SET search_path = 'public'
-- This prevents potential privilege escalation attacks via search_path manipulation

-- 1. Fix create_notification function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id = p_actor_id THEN
    RETURN;
  END IF;
  
  INSERT INTO notifications (
    user_id, type, title, message, actor_id, 
    content_type, content_id, metadata
  ) VALUES (
    p_user_id, p_type, p_title, p_message, p_actor_id,
    p_content_type, p_content_id, p_metadata
  );
END;
$$;

-- 2. Fix notify_new_follow function
CREATE OR REPLACE FUNCTION notify_new_follow()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT COALESCE(display_name, username) INTO follower_name
  FROM profiles WHERE id = NEW.follower_id;
  
  PERFORM create_notification(
    NEW.following_id,
    'follow',
    'New Follower',
    follower_name || ' started following you',
    NEW.follower_id,
    NULL,
    NULL,
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  
  RETURN NEW;
END;
$$;

-- 3. Fix notify_donation function
CREATE OR REPLACE FUNCTION notify_donation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  donor_wallet TEXT;
  content_title TEXT;
  creator_amount NUMERIC;
BEGIN
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;
  
  creator_amount := NEW.amount * 0.95;
  donor_wallet := NEW.donor_wallet_address;
  
  IF NEW.content_type = 'livestream' THEN
    SELECT title INTO content_title FROM livestreams WHERE id = NEW.content_id;
  ELSIF NEW.content_type = 'shortvideo' THEN
    SELECT title INTO content_title FROM short_videos WHERE id = NEW.content_id;
  ELSIF NEW.content_type = 'wutch_video' THEN
    SELECT title INTO content_title FROM wutch_videos WHERE id = NEW.content_id;
  END IF;
  
  PERFORM create_notification(
    NEW.recipient_user_id,
    'donation',
    'New Donation Received! 🎉',
    'Received ' || creator_amount || ' SOL' || 
      CASE WHEN content_title IS NOT NULL THEN ' on "' || content_title || '"' ELSE '' END,
    NULL,
    NEW.content_type::TEXT,
    NEW.content_id,
    jsonb_build_object(
      'amount', creator_amount,
      'donor_wallet', donor_wallet,
      'content_title', content_title
    )
  );
  
  RETURN NEW;
END;
$$;

-- 4. Fix notify_livestream_like function
CREATE OR REPLACE FUNCTION notify_livestream_like()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name TEXT;
  stream_title TEXT;
  stream_creator UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO liker_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT title, user_id INTO stream_title, stream_creator
  FROM livestreams WHERE id = NEW.livestream_id;
  
  PERFORM create_notification(
    stream_creator,
    'like',
    'New Like ❤️',
    liker_name || ' liked your stream "' || stream_title || '"',
    NEW.user_id,
    'livestream',
    NEW.livestream_id,
    jsonb_build_object('stream_title', stream_title)
  );
  
  RETURN NEW;
END;
$$;

-- 5. Fix notify_short_video_like function
CREATE OR REPLACE FUNCTION notify_short_video_like()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name TEXT;
  video_title TEXT;
  video_creator UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO liker_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT title, user_id INTO video_title, video_creator
  FROM short_videos WHERE id = NEW.short_video_id;
  
  PERFORM create_notification(
    video_creator,
    'like',
    'New Like ❤️',
    liker_name || ' liked your short "' || video_title || '"',
    NEW.user_id,
    'shortvideo',
    NEW.short_video_id,
    jsonb_build_object('video_title', video_title)
  );
  
  RETURN NEW;
END;
$$;

-- 6. Fix notify_wutch_video_like function
CREATE OR REPLACE FUNCTION notify_wutch_video_like()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name TEXT;
  video_title TEXT;
  video_creator UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO liker_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT title, user_id INTO video_title, video_creator
  FROM wutch_videos WHERE id = NEW.wutch_video_id;
  
  PERFORM create_notification(
    video_creator,
    'like',
    'New Like ❤️',
    liker_name || ' liked your video "' || video_title || '"',
    NEW.user_id,
    'wutch_video',
    NEW.wutch_video_id,
    jsonb_build_object('video_title', video_title)
  );
  
  RETURN NEW;
END;
$$;

-- 7. Fix notify_comment function
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commenter_name TEXT;
  content_title TEXT;
  content_creator UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO commenter_name
  FROM profiles WHERE id = NEW.user_id;
  
  IF NEW.content_type = 'livestream' THEN
    SELECT title, user_id INTO content_title, content_creator
    FROM livestreams WHERE id = NEW.content_id;
  ELSIF NEW.content_type = 'shortvideo' THEN
    SELECT title, user_id INTO content_title, content_creator
    FROM short_videos WHERE id = NEW.content_id;
  ELSIF NEW.content_type = 'wutch_video' THEN
    SELECT title, user_id INTO content_title, content_creator
    FROM wutch_videos WHERE id = NEW.content_id;
  END IF;
  
  PERFORM create_notification(
    content_creator,
    'comment',
    'New Comment 💬',
    commenter_name || ' commented on "' || content_title || '"',
    NEW.user_id,
    NEW.content_type::TEXT,
    NEW.content_id,
    jsonb_build_object(
      'content_title', content_title,
      'comment_text', LEFT(NEW.text, 100)
    )
  );
  
  RETURN NEW;
END;
$$;

-- 8. Fix notify_bounty_claim function
CREATE OR REPLACE FUNCTION notify_bounty_claim()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimer_name TEXT;
  stream_title TEXT;
  bounty_creator UUID;
  livestream_id UUID;
BEGIN
  IF NOT NEW.is_correct THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(display_name, username) INTO claimer_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT creator_id, sb.livestream_id INTO bounty_creator, livestream_id
  FROM stream_bounties sb WHERE id = NEW.bounty_id;
  
  SELECT title INTO stream_title FROM livestreams WHERE id = livestream_id;
  
  PERFORM create_notification(
    bounty_creator,
    'bounty_claim',
    'Bounty Claimed! 🎯',
    claimer_name || ' claimed your bounty on "' || stream_title || '"',
    NEW.user_id,
    'livestream',
    livestream_id,
    jsonb_build_object(
      'stream_title', stream_title,
      'reward_amount', NEW.reward_amount
    )
  );
  
  RETURN NEW;
END;
$$;

-- 9. Fix notify_share function
CREATE OR REPLACE FUNCTION notify_share()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sharer_name TEXT;
  stream_title TEXT;
  campaign_creator UUID;
  livestream_id UUID;
BEGIN
  SELECT COALESCE(display_name, username) INTO sharer_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT creator_id, sc.livestream_id INTO campaign_creator, livestream_id
  FROM sharing_campaigns sc WHERE id = NEW.campaign_id;
  
  SELECT title INTO stream_title FROM livestreams WHERE id = livestream_id;
  
  PERFORM create_notification(
    campaign_creator,
    'share',
    'Content Shared! 🔄',
    sharer_name || ' shared "' || stream_title || '" on ' || NEW.share_platform,
    NEW.user_id,
    'livestream',
    livestream_id,
    jsonb_build_object(
      'stream_title', stream_title,
      'share_platform', NEW.share_platform,
      'reward_amount', NEW.reward_amount
    )
  );
  
  RETURN NEW;
END;
$$;

-- 10. Create MFA rate limiting table
CREATE TABLE IF NOT EXISTS public.mfa_verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_id ON public.mfa_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_locked_until ON public.mfa_verification_attempts(locked_until);

-- Enable RLS
ALTER TABLE public.mfa_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Only the system (edge functions) can manage MFA attempts
CREATE POLICY "System can manage MFA attempts"
ON public.mfa_verification_attempts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Function to clean up old attempts
CREATE OR REPLACE FUNCTION cleanup_mfa_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete attempts older than 24 hours
  DELETE FROM public.mfa_verification_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;