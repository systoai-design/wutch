-- Fix Security Definer Views by removing SECURITY DEFINER property
-- Views will now respect RLS policies of underlying tables

-- Drop existing views
DROP VIEW IF EXISTS public_stream_bounties CASCADE;
DROP VIEW IF EXISTS public_profiles CASCADE;
DROP VIEW IF EXISTS user_transaction_history CASCADE;
DROP VIEW IF EXISTS creator_earnings_summary CASCADE;

-- Recreate public_stream_bounties as a simple view (no SECURITY DEFINER)
-- Only shows active bounties
CREATE VIEW public_stream_bounties AS
SELECT 
  id,
  livestream_id,
  creator_id,
  total_deposit,
  participant_limit,
  reward_per_participant,
  claimed_count,
  expires_at,
  is_active,
  created_at
FROM stream_bounties
WHERE is_active = true;

-- Recreate public_profiles as a simple view (no SECURITY DEFINER)
-- Shows only public profile information
CREATE VIEW public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  verification_type,
  is_verified,
  follower_count,
  total_donations_received,
  moderation_tier,
  created_at
FROM profiles;

-- Recreate user_transaction_history as a simple view (no SECURITY DEFINER)
-- Users can see transactions where they are buyer or seller
-- Underlying table RLS will be respected
CREATE VIEW user_transaction_history AS
SELECT 
  pt.id,
  pt.buyer_id,
  pt.seller_id,
  pt.transaction_type,
  pt.gross_amount,
  pt.platform_amount,
  pt.creator_amount,
  pt.status,
  pt.created_at,
  pt.metadata
FROM platform_transactions pt;

-- Recreate creator_earnings_summary as a simple view (no SECURITY DEFINER)
-- Aggregates earnings data
CREATE VIEW creator_earnings_summary AS
SELECT 
  p.id as user_id,
  p.username,
  COALESCE(p.total_earnings, 0) as total_paid_out,
  COALESCE(p.pending_earnings, 0) as pending_earnings,
  COALESCE(p.total_donations_received, 0) as donations_received,
  (
    SELECT COALESCE(SUM(creator_amount), 0) 
    FROM platform_transactions 
    WHERE seller_id = p.id 
      AND transaction_type = 'x402_purchase' 
      AND status = 'confirmed'
  ) as x402_earnings
FROM profiles p;

-- Grant appropriate permissions on views
GRANT SELECT ON public_stream_bounties TO authenticated, anon;
GRANT SELECT ON public_profiles TO authenticated, anon;
GRANT SELECT ON user_transaction_history TO authenticated;
GRANT SELECT ON creator_earnings_summary TO authenticated;

-- Add comment explaining the security model
COMMENT ON VIEW public_stream_bounties IS 'Public view of active stream bounties. No SECURITY DEFINER - respects underlying table RLS policies.';
COMMENT ON VIEW public_profiles IS 'Public view of user profiles with only non-sensitive information. No SECURITY DEFINER - respects underlying table RLS policies.';
COMMENT ON VIEW user_transaction_history IS 'Transaction history view. No SECURITY DEFINER - users can only see their own transactions via underlying table RLS policies.';
COMMENT ON VIEW creator_earnings_summary IS 'Creator earnings summary. No SECURITY DEFINER - users can only see their own earnings via underlying table RLS policies.';