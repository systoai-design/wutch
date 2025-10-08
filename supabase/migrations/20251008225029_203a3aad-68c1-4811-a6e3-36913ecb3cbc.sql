-- Create leaderboard functions for rankings

-- Function to get most earned leaderboard
CREATE OR REPLACE FUNCTION public.get_most_earned_leaderboard(limit_count int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_earned numeric,
  paid_out numeric,
  pending numeric,
  rank bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    (COALESCE(p.total_earnings, 0) + COALESCE(p.pending_earnings, 0)) as total_earned,
    COALESCE(p.total_earnings, 0) as paid_out,
    COALESCE(p.pending_earnings, 0) as pending,
    ROW_NUMBER() OVER (ORDER BY (COALESCE(p.total_earnings, 0) + COALESCE(p.pending_earnings, 0)) DESC) as rank
  FROM profiles p
  WHERE (COALESCE(p.total_earnings, 0) + COALESCE(p.pending_earnings, 0)) > 0
  ORDER BY total_earned DESC
  LIMIT limit_count;
$$;

-- Function to get most donated (received) leaderboard
CREATE OR REPLACE FUNCTION public.get_most_donated_leaderboard(limit_count int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_received numeric,
  donation_count bigint,
  rank bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id as user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(p.total_donations_received, 0) as total_received,
    COUNT(d.id) as donation_count,
    ROW_NUMBER() OVER (ORDER BY COALESCE(p.total_donations_received, 0) DESC) as rank
  FROM profiles p
  LEFT JOIN donations d ON d.recipient_user_id = p.id AND d.status = 'confirmed'
  WHERE COALESCE(p.total_donations_received, 0) > 0
  GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.total_donations_received
  ORDER BY total_received DESC
  LIMIT limit_count;
$$;

-- Function to get most rewards given leaderboard
CREATE OR REPLACE FUNCTION public.get_most_rewards_given_leaderboard(limit_count int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_rewards_given numeric,
  bounties_total numeric,
  bounties_count bigint,
  campaigns_total numeric,
  campaigns_count bigint,
  rank bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_rewards AS (
    SELECT 
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      COALESCE(SUM(sb.total_deposit), 0) as bounties_total,
      COUNT(DISTINCT sb.id) as bounties_count,
      COALESCE(SUM(sc.total_budget), 0) as campaigns_total,
      COUNT(DISTINCT sc.id) as campaigns_count,
      COALESCE(SUM(sb.total_deposit), 0) + COALESCE(SUM(sc.total_budget), 0) as total_rewards_given
    FROM profiles p
    LEFT JOIN stream_bounties sb ON sb.creator_id = p.id
    LEFT JOIN sharing_campaigns sc ON sc.creator_id = p.id
    GROUP BY p.id, p.username, p.display_name, p.avatar_url
  )
  SELECT 
    ur.id as user_id,
    ur.username,
    ur.display_name,
    ur.avatar_url,
    ur.total_rewards_given,
    ur.bounties_total,
    ur.bounties_count,
    ur.campaigns_total,
    ur.campaigns_count,
    ROW_NUMBER() OVER (ORDER BY ur.total_rewards_given DESC) as rank
  FROM user_rewards ur
  WHERE ur.total_rewards_given > 0
  ORDER BY ur.total_rewards_given DESC
  LIMIT limit_count;
$$;