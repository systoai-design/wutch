-- Update notify_share function to handle NULL values properly
CREATE OR REPLACE FUNCTION public.notify_share()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sharer_name TEXT;
  stream_title TEXT;
  campaign_creator UUID;
  livestream_id UUID;
  notification_message TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO sharer_name
  FROM profiles WHERE id = NEW.user_id;
  
  SELECT creator_id, sc.livestream_id INTO campaign_creator, livestream_id
  FROM sharing_campaigns sc WHERE id = NEW.campaign_id;
  
  -- Only get stream title if livestream exists
  IF livestream_id IS NOT NULL THEN
    SELECT title INTO stream_title FROM livestreams WHERE id = livestream_id;
  END IF;
  
  -- Build notification message with NULL handling
  IF stream_title IS NOT NULL THEN
    notification_message := sharer_name || ' shared "' || stream_title || '" on ' || COALESCE(NEW.share_platform, 'social media');
  ELSE
    notification_message := sharer_name || ' completed a share for your campaign';
  END IF;
  
  -- Create notification
  PERFORM create_notification(
    campaign_creator,
    'share',
    'Content Shared! 🔄',
    notification_message,
    NEW.user_id,
    CASE WHEN livestream_id IS NOT NULL THEN 'livestream' ELSE NULL END,
    livestream_id,
    jsonb_build_object(
      'stream_title', COALESCE(stream_title, 'N/A'),
      'share_platform', COALESCE(NEW.share_platform, 'unknown'),
      'reward_amount', NEW.reward_amount,
      'campaign_id', NEW.campaign_id
    )
  );
  
  RETURN NEW;
END;
$$;