-- Create function to get campaign analytics for a creator
CREATE OR REPLACE FUNCTION get_campaign_analytics(creator_user_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  content_id UUID,
  content_type TEXT,
  content_title TEXT,
  reward_per_share NUMERIC,
  total_budget NUMERIC,
  spent_budget NUMERIC,
  total_shares BIGINT,
  unique_sharers BIGINT,
  twitter_shares BIGINT,
  total_rewards_paid NUMERIC,
  pending_rewards NUMERIC,
  avg_reward_per_share NUMERIC,
  conversion_rate NUMERIC,
  created_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id as campaign_id,
    sc.content_id,
    sc.content_type::TEXT,
    COALESCE(
      l.title,
      sv.title,
      wv.title
    ) as content_title,
    sc.reward_per_share,
    sc.total_budget,
    sc.spent_budget,
    COUNT(us.id) as total_shares,
    COUNT(DISTINCT us.user_id) as unique_sharers,
    COUNT(us.id) FILTER (WHERE us.share_platform = 'twitter') as twitter_shares,
    COALESCE(SUM(us.reward_amount) FILTER (WHERE us.status = 'paid'), 0) as total_rewards_paid,
    COALESCE(SUM(us.reward_amount) FILTER (WHERE us.status = 'pending'), 0) as pending_rewards,
    COALESCE(AVG(us.reward_amount), 0) as avg_reward_per_share,
    CASE 
      WHEN COUNT(us.id) > 0 THEN 
        (COUNT(us.id) FILTER (WHERE us.status = 'paid')::NUMERIC / COUNT(us.id)::NUMERIC * 100)
      ELSE 0
    END as conversion_rate,
    sc.created_at,
    sc.is_active
  FROM sharing_campaigns sc
  LEFT JOIN user_shares us ON us.campaign_id = sc.id
  LEFT JOIN livestreams l ON sc.content_type = 'livestream' AND sc.content_id = l.id
  LEFT JOIN short_videos sv ON sc.content_type = 'short_video' AND sc.content_id = sv.id
  LEFT JOIN wutch_videos wv ON sc.content_type = 'wutch_video' AND sc.content_id = wv.id
  WHERE sc.creator_id = creator_user_id
  GROUP BY 
    sc.id, sc.content_id, sc.content_type, sc.reward_per_share,
    sc.total_budget, sc.spent_budget, sc.created_at, sc.is_active,
    l.title, sv.title, wv.title
  ORDER BY sc.created_at DESC;
END;
$$;

-- Create function to get top sharers for a campaign
CREATE OR REPLACE FUNCTION get_campaign_top_sharers(campaign_uuid UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  total_shares BIGINT,
  total_earned NUMERIC,
  last_share_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COUNT(us.id) as total_shares,
    COALESCE(SUM(us.reward_amount), 0) as total_earned,
    MAX(us.created_at) as last_share_at
  FROM user_shares us
  JOIN profiles p ON p.id = us.user_id
  WHERE us.campaign_id = campaign_uuid
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  ORDER BY total_shares DESC, total_earned DESC
  LIMIT limit_count;
END;
$$;