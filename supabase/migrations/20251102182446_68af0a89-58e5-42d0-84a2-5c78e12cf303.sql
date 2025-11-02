-- Fix view column mappings to match actual table schemas

-- Drop and recreate views with correct columns
DROP VIEW IF EXISTS public_stream_bounties CASCADE;
DROP VIEW IF EXISTS public_profiles CASCADE;
DROP VIEW IF EXISTS user_transaction_history CASCADE;
DROP VIEW IF EXISTS creator_earnings_summary CASCADE;

-- Recreate public_stream_bounties with all necessary columns
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
  created_at,
  updated_at,
  platform_fee_amount,
  secret_word
FROM stream_bounties
WHERE is_active = true;

-- Recreate public_profiles with all necessary columns (no wallet_address - that's in profile_wallets)
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
  created_at,
  social_links,
  total_earnings,
  pending_earnings,
  public_wallet_address,
  promotional_link,
  promotional_link_text
FROM profiles;

-- Recreate user_transaction_history with all columns
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
  pt.confirmed_at,
  pt.transaction_signature,
  pt.content_type,
  pt.content_id,
  pt.metadata,
  -- Add seller username for display
  (SELECT username FROM profiles WHERE id = pt.seller_id) as seller_username,
  -- Add buyer username for display
  (SELECT username FROM profiles WHERE id = pt.buyer_id) as buyer_username
FROM platform_transactions pt;

-- Recreate creator_earnings_summary
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
  ) as x402_earnings,
  (
    SELECT COALESCE(SUM(creator_amount), 0)
    FROM platform_transactions
    WHERE seller_id = p.id AND status = 'confirmed'
  ) as confirmed_earned
FROM profiles p;

-- Grant permissions
GRANT SELECT ON public_stream_bounties TO authenticated, anon;
GRANT SELECT ON public_profiles TO authenticated, anon;
GRANT SELECT ON user_transaction_history TO authenticated;
GRANT SELECT ON creator_earnings_summary TO authenticated;