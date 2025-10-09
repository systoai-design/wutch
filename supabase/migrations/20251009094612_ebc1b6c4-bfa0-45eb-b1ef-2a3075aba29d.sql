-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT,
  content_id UUID,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Generic notification creator function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow notifications trigger
CREATE OR REPLACE FUNCTION notify_new_follow()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_follow();

-- Donation notifications trigger
CREATE OR REPLACE FUNCTION notify_donation()
RETURNS TRIGGER AS $$
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
  ELSIF NEW.content_type = 'short_video' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_donation
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION notify_donation();

-- Livestream like notifications trigger
CREATE OR REPLACE FUNCTION notify_livestream_like()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_livestream_like
  AFTER INSERT ON livestream_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_livestream_like();

-- Short video like notifications trigger
CREATE OR REPLACE FUNCTION notify_short_video_like()
RETURNS TRIGGER AS $$
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
    'short_video',
    NEW.short_video_id,
    jsonb_build_object('video_title', video_title)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_short_video_like
  AFTER INSERT ON short_video_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_short_video_like();

-- Wutch video like notifications trigger
CREATE OR REPLACE FUNCTION notify_wutch_video_like()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_wutch_video_like
  AFTER INSERT ON wutch_video_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_wutch_video_like();

-- Comment notifications trigger
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
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
  ELSIF NEW.content_type = 'short_video' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment();

-- Bounty claim notifications trigger
CREATE OR REPLACE FUNCTION notify_bounty_claim()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_bounty_claim
  AFTER INSERT ON bounty_claims
  FOR EACH ROW
  EXECUTE FUNCTION notify_bounty_claim();

-- Share notifications trigger
CREATE OR REPLACE FUNCTION notify_share()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_share
  AFTER INSERT ON user_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_share();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;