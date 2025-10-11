-- Fix remaining SECURITY DEFINER views
-- Convert moderation_queue and user_trust_stats to SECURITY INVOKER

DROP VIEW IF EXISTS public.moderation_queue CASCADE;
DROP VIEW IF EXISTS public.user_trust_stats CASCADE;

-- Recreate moderation_queue with SECURITY INVOKER
CREATE OR REPLACE VIEW public.moderation_queue 
WITH (security_invoker=true) AS
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
    WHEN cm.content_type = 'livestream' THEN l.thumbnail_url
    WHEN cm.content_type = 'shortvideo' THEN sv.thumbnail_url
    WHEN cm.content_type = 'wutch_video' THEN wv.thumbnail_url
  END AS content_url,
  CASE 
    WHEN cm.content_type = 'livestream' THEN l.title
    WHEN cm.content_type = 'shortvideo' THEN sv.title
    WHEN cm.content_type = 'wutch_video' THEN wv.title
  END AS content_title
FROM content_moderation cm
LEFT JOIN profiles p ON cm.user_id = p.id
LEFT JOIN livestreams l ON cm.content_type = 'livestream' AND cm.content_id = l.id
LEFT JOIN short_videos sv ON cm.content_type = 'shortvideo' AND cm.content_id = sv.id
LEFT JOIN wutch_videos wv ON cm.content_type = 'wutch_video' AND cm.content_id = wv.id
WHERE cm.status = 'pending';

-- Recreate user_trust_stats with SECURITY INVOKER
CREATE OR REPLACE VIEW public.user_trust_stats 
WITH (security_invoker=true) AS
SELECT 
  p.id,
  p.trust_score,
  p.content_violation_count,
  p.moderation_tier,
  p.verification_type,
  p.is_verified,
  p.created_at,
  p.follower_count,
  COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN l.id END) +
  COUNT(DISTINCT CASE WHEN sv.id IS NOT NULL THEN sv.id END) +
  COUNT(DISTINCT CASE WHEN wv.id IS NOT NULL THEN wv.id END) AS total_uploads,
  COALESCE(SUM(CASE WHEN l.id IS NOT NULL THEN l.viewer_count ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN sv.id IS NOT NULL THEN sv.view_count ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN wv.id IS NOT NULL THEN wv.view_count ELSE 0 END), 0) AS total_views,
  CASE
    WHEN p.is_verified AND p.verification_type IN ('blue', 'red') THEN 'verified'
    WHEN p.follower_count >= 100 
         AND (COALESCE(SUM(CASE WHEN l.id IS NOT NULL THEN l.viewer_count ELSE 0 END), 0) +
              COALESCE(SUM(CASE WHEN sv.id IS NOT NULL THEN sv.view_count ELSE 0 END), 0) +
              COALESCE(SUM(CASE WHEN wv.id IS NOT NULL THEN wv.view_count ELSE 0 END), 0)) >= 1000 
         AND p.content_violation_count = 0 THEN 'established'
    WHEN p.content_violation_count >= 3 THEN 'flagged'
    ELSE 'new'
  END AS calculated_tier
FROM profiles p
LEFT JOIN livestreams l ON l.user_id = p.id
LEFT JOIN short_videos sv ON sv.user_id = p.id
LEFT JOIN wutch_videos wv ON wv.user_id = p.id
GROUP BY p.id;