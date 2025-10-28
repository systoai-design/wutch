-- Add X402 and badge verification support
-- Add indexes for X402 transactions queries
CREATE INDEX IF NOT EXISTS idx_platform_transactions_x402_seller 
ON platform_transactions(seller_id, transaction_type, status) 
WHERE transaction_type = 'x402_purchase';

CREATE INDEX IF NOT EXISTS idx_platform_transactions_x402_buyer 
ON platform_transactions(buyer_id, transaction_type, status) 
WHERE transaction_type = 'x402_purchase';

-- Add index for badge verification payments
CREATE INDEX IF NOT EXISTS idx_platform_transactions_badge_verification
ON platform_transactions(buyer_id, transaction_type, status)
WHERE transaction_type = 'badge_verification';

-- Function to get user X402 earnings and spending stats
CREATE OR REPLACE FUNCTION get_user_x402_stats(p_user_id uuid)
RETURNS TABLE (
  total_premium_earned numeric,
  premium_sales_count bigint,
  total_premium_spent numeric,
  premium_purchases_count bigint,
  livestream_sales numeric,
  livestream_sales_count bigint,
  shortvideo_sales numeric,
  shortvideo_sales_count bigint,
  wutch_video_sales numeric,
  wutch_video_sales_count bigint,
  livestream_purchases numeric,
  livestream_purchases_count bigint,
  shortvideo_purchases numeric,
  shortvideo_purchases_count bigint,
  wutch_video_purchases numeric,
  wutch_video_purchases_count bigint
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH seller_stats AS (
    SELECT 
      COALESCE(SUM(pt.creator_amount), 0) as earned,
      COUNT(DISTINCT pt.id) as sales_count,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'livestream' THEN pt.creator_amount ELSE 0 END), 0) as livestream_earned,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'livestream' THEN pt.id END) as livestream_count,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'shortvideo' THEN pt.creator_amount ELSE 0 END), 0) as shortvideo_earned,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'shortvideo' THEN pt.id END) as shortvideo_count,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'wutch_video' THEN pt.creator_amount ELSE 0 END), 0) as wutch_earned,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'wutch_video' THEN pt.id END) as wutch_count
    FROM platform_transactions pt
    WHERE pt.seller_id = p_user_id 
      AND pt.transaction_type = 'x402_purchase'
      AND pt.status = 'confirmed'
  ),
  buyer_stats AS (
    SELECT 
      COALESCE(SUM(pt.gross_amount), 0) as spent,
      COUNT(DISTINCT pt.id) as purchase_count,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'livestream' THEN pt.gross_amount ELSE 0 END), 0) as livestream_spent,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'livestream' THEN pt.id END) as livestream_purchases,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'shortvideo' THEN pt.gross_amount ELSE 0 END), 0) as shortvideo_spent,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'shortvideo' THEN pt.id END) as shortvideo_purchases,
      COALESCE(SUM(CASE WHEN pt.metadata->>'content_type' = 'wutch_video' THEN pt.gross_amount ELSE 0 END), 0) as wutch_spent,
      COUNT(DISTINCT CASE WHEN pt.metadata->>'content_type' = 'wutch_video' THEN pt.id END) as wutch_purchases
    FROM platform_transactions pt
    WHERE pt.buyer_id = p_user_id 
      AND pt.transaction_type = 'x402_purchase'
      AND pt.status = 'confirmed'
  )
  SELECT 
    s.earned,
    s.sales_count,
    b.spent,
    b.purchase_count,
    s.livestream_earned,
    s.livestream_count,
    s.shortvideo_earned,
    s.shortvideo_count,
    s.wutch_earned,
    s.wutch_count,
    b.livestream_spent,
    b.livestream_purchases,
    b.shortvideo_spent,
    b.shortvideo_purchases,
    b.wutch_spent,
    b.wutch_purchases
  FROM seller_stats s, buyer_stats b;
END;
$$;

-- Update get_user_financial_stats to include X402 earnings
CREATE OR REPLACE FUNCTION public.get_user_financial_stats(p_user_id uuid)
RETURNS TABLE(total_earned numeric, total_rewards_given numeric, total_donated numeric, total_received numeric, earnings_breakdown jsonb, rewards_breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total Earned (paid out + pending + x402)
    COALESCE(p.total_earnings, 0) + COALESCE(p.pending_earnings, 0) + 
    COALESCE((SELECT SUM(creator_amount) FROM platform_transactions WHERE seller_id = p_user_id AND transaction_type = 'x402_purchase' AND status = 'confirmed'), 0) as total_earned,
    
    -- Total Rewards Given (bounties + campaigns deposited)
    (
      SELECT COALESCE(SUM(total_deposit), 0)
      FROM stream_bounties
      WHERE creator_id = p_user_id
    ) + (
      SELECT COALESCE(SUM(total_budget), 0)
      FROM sharing_campaigns
      WHERE creator_id = p_user_id
    ) as total_rewards_given,
    
    -- Total Donated
    (
      SELECT COALESCE(SUM(d.amount), 0)
      FROM donations d
      JOIN profile_wallets pw ON pw.wallet_address = d.donor_wallet_address
      WHERE pw.user_id = p_user_id AND d.status = 'confirmed'
    ) as total_donated,
    
    -- Total Received (existing field)
    COALESCE(p.total_donations_received, 0) as total_received,
    
    -- Earnings breakdown with X402
    jsonb_build_object(
      'view_earnings', (SELECT COALESCE(SUM(earnings_amount), 0) FROM view_earnings WHERE user_id = p_user_id),
      'bounty_earnings', (SELECT COALESCE(SUM(reward_amount), 0) FROM bounty_claims WHERE user_id = p_user_id AND is_correct = true),
      'share_earnings', (SELECT COALESCE(SUM(reward_amount), 0) FROM user_shares WHERE user_id = p_user_id AND status = 'paid'),
      'x402_earnings', (SELECT COALESCE(SUM(creator_amount), 0) FROM platform_transactions WHERE seller_id = p_user_id AND transaction_type = 'x402_purchase' AND status = 'confirmed'),
      'pending', COALESCE(p.pending_earnings, 0),
      'paid_out', COALESCE(p.total_earnings, 0)
    ) as earnings_breakdown,
    
    -- Rewards breakdown
    jsonb_build_object(
      'bounties_created', (SELECT COUNT(*) FROM stream_bounties WHERE creator_id = p_user_id),
      'bounties_total', (SELECT COALESCE(SUM(total_deposit), 0) FROM stream_bounties WHERE creator_id = p_user_id),
      'bounties_paid', (SELECT COALESCE(SUM(reward_per_participant * claimed_count), 0) FROM stream_bounties WHERE creator_id = p_user_id),
      'campaigns_created', (SELECT COUNT(*) FROM sharing_campaigns WHERE creator_id = p_user_id),
      'campaigns_total', (SELECT COALESCE(SUM(total_budget), 0) FROM sharing_campaigns WHERE creator_id = p_user_id),
      'campaigns_spent', (SELECT COALESCE(SUM(spent_budget), 0) FROM sharing_campaigns WHERE creator_id = p_user_id)
    ) as rewards_breakdown
    
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;