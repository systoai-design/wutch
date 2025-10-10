-- Add trust metrics to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_violation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_violation_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS moderation_tier TEXT DEFAULT 'new' CHECK (moderation_tier IN ('verified', 'established', 'new', 'flagged'));

-- Create user statistics view for trust calculation
CREATE OR REPLACE VIEW user_trust_stats AS
SELECT 
  p.id,
  p.trust_score,
  p.content_violation_count,
  p.moderation_tier,
  p.verification_type,
  p.is_verified,
  p.created_at,
  p.follower_count,
  COALESCE(COUNT(DISTINCT sv.id), 0) + 
    COALESCE(COUNT(DISTINCT wv.id), 0) + 
    COALESCE(COUNT(DISTINCT ls.id), 0) as total_uploads,
  COALESCE(SUM(sv.view_count), 0) + 
    COALESCE(SUM(wv.view_count), 0) + 
    COALESCE(SUM(ls.viewer_count), 0) as total_views,
  -- Calculate trust tier
  CASE
    WHEN p.verification_type IN ('red', 'blue') THEN 'verified'
    WHEN p.content_violation_count >= 3 THEN 'flagged'
    WHEN p.created_at < NOW() - INTERVAL '30 days' 
      AND (COALESCE(COUNT(DISTINCT sv.id), 0) + COALESCE(COUNT(DISTINCT wv.id), 0)) >= 5
      AND (p.follower_count >= 50 OR 
           (COALESCE(SUM(sv.view_count), 0) + COALESCE(SUM(wv.view_count), 0)) >= 1000)
    THEN 'established'
    ELSE 'new'
  END as calculated_tier
FROM profiles p
LEFT JOIN short_videos sv ON sv.user_id = p.id
LEFT JOIN wutch_videos wv ON wv.user_id = p.id
LEFT JOIN livestreams ls ON ls.user_id = p.id
GROUP BY p.id;

-- Function to get user's moderation tier
CREATE OR REPLACE FUNCTION get_user_moderation_tier(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier TEXT;
BEGIN
  SELECT calculated_tier INTO tier
  FROM user_trust_stats
  WHERE id = user_id;
  
  RETURN COALESCE(tier, 'new');
END;
$$;

-- Function to update profiles moderation tier (run periodically)
CREATE OR REPLACE FUNCTION update_user_moderation_tiers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles p
  SET moderation_tier = uts.calculated_tier
  FROM user_trust_stats uts
  WHERE p.id = uts.id
    AND p.moderation_tier != uts.calculated_tier;
END;
$$;

-- Add columns to content_moderation table
ALTER TABLE content_moderation
  ADD COLUMN IF NOT EXISTS skipped_reason TEXT,
  ADD COLUMN IF NOT EXISTS user_tier TEXT;

-- Function to flag user for violations
CREATE OR REPLACE FUNCTION flag_user_violation(
  p_user_id UUID,
  p_content_id UUID,
  p_content_type TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment violation count
  UPDATE profiles
  SET 
    content_violation_count = content_violation_count + 1,
    last_violation_at = NOW(),
    moderation_tier = CASE 
      WHEN content_violation_count + 1 >= 3 THEN 'flagged'
      ELSE moderation_tier
    END
  WHERE id = p_user_id;
  
  -- Log the violation
  INSERT INTO content_moderation (
    user_id, content_type, content_id, status, rejection_reason
  ) VALUES (
    p_user_id, p_content_type, p_content_id, 'rejected', p_reason
  );
END;
$$;