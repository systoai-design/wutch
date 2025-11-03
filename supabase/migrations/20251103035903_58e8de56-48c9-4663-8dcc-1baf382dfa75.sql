-- Drop and recreate views with correct columns

DROP VIEW IF EXISTS public_profiles CASCADE;
DROP VIEW IF EXISTS user_transaction_history CASCADE;
DROP VIEW IF EXISTS creator_earnings_summary CASCADE;

-- Recreate public_profiles view with banner_url
CREATE VIEW public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  banner_url,
  bio,
  verification_type,
  moderation_tier,
  is_verified,
  follower_count,
  total_donations_received,
  total_earnings,
  pending_earnings,
  created_at,
  social_links,
  public_wallet_address,
  promotional_link,
  promotional_link_text
FROM profiles;

GRANT SELECT ON public_profiles TO authenticated, anon;

-- Recreate user_transaction_history view with display names
CREATE VIEW user_transaction_history AS
SELECT 
  pt.id,
  pt.buyer_id,
  pt.seller_id,
  pt.gross_amount,
  pt.platform_amount,
  pt.creator_amount,
  pt.transaction_type,
  pt.transaction_signature,
  pt.status,
  pt.created_at,
  pt.confirmed_at,
  pt.content_id,
  pt.content_type,
  pt.metadata,
  bp.username as buyer_username,
  bp.display_name as buyer_display_name,
  sp.username as seller_username,
  sp.display_name as seller_display_name
FROM platform_transactions pt
LEFT JOIN profiles bp ON pt.buyer_id = bp.id
LEFT JOIN profiles sp ON pt.seller_id = sp.id;

GRANT SELECT ON user_transaction_history TO authenticated, anon;

-- Recreate creator_earnings_summary - simplified without transaction_type grouping
CREATE VIEW creator_earnings_summary AS
SELECT 
  p.id as user_id,
  p.username,
  COALESCE(SUM(CASE 
    WHEN pt.status = 'confirmed' 
    THEN pt.creator_amount 
    ELSE 0 
  END), 0) as confirmed_earned,
  p.pending_earnings,
  p.total_earnings as total_paid_out,
  COALESCE(SUM(CASE 
    WHEN pt.transaction_type = 'donation' AND pt.status = 'confirmed'
    THEN pt.creator_amount 
    ELSE 0 
  END), 0) as donations_received,
  COALESCE(SUM(CASE 
    WHEN pt.transaction_type IN ('x402_purchase', 'service_purchase') AND pt.status = 'confirmed'
    THEN pt.creator_amount 
    ELSE 0 
  END), 0) as x402_earnings
FROM profiles p
LEFT JOIN platform_transactions pt ON p.id = pt.seller_id
GROUP BY p.id, p.username, p.pending_earnings, p.total_earnings;

GRANT SELECT ON creator_earnings_summary TO authenticated, anon;