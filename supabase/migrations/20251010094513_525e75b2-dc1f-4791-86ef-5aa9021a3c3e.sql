-- Fix notify_comment to use 'shortvideo' instead of 'short_video'
CREATE OR REPLACE FUNCTION public.notify_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- Fix notify_donation to use 'shortvideo' instead of 'short_video'
CREATE OR REPLACE FUNCTION public.notify_donation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- Fix notify_short_video_like to use 'shortvideo' instead of 'short_video'
CREATE OR REPLACE FUNCTION public.notify_short_video_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- Normalize existing notifications data
UPDATE notifications SET content_type = 'shortvideo' WHERE content_type = 'short_video';

-- Ensure CPM settings work with 'shortvideo'
UPDATE platform_revenue_pool
SET settings = jsonb_set(
  settings,
  '{cpm_rates,shortvideo}',
  COALESCE(settings->'cpm_rates'->'shortvideo', settings->'cpm_rates'->'short_video', '0.10'::jsonb),
  true
) WHERE settings->'cpm_rates'->'shortvideo' IS NULL;