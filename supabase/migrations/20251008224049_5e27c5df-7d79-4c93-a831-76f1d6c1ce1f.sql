-- Create function to calculate user financial stats
CREATE OR REPLACE FUNCTION public.get_user_financial_stats(p_user_id uuid)
RETURNS TABLE (
  total_earned numeric,
  total_rewards_given numeric,
  total_donated numeric,
  total_received numeric,
  earnings_breakdown jsonb,
  rewards_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total Earned (paid out + pending)
    COALESCE(p.total_earnings, 0) + COALESCE(p.pending_earnings, 0) as total_earned,
    
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
    
    -- Earnings breakdown
    jsonb_build_object(
      'view_earnings', (SELECT COALESCE(SUM(earnings_amount), 0) FROM view_earnings WHERE user_id = p_user_id),
      'bounty_earnings', (SELECT COALESCE(SUM(reward_amount), 0) FROM bounty_claims WHERE user_id = p_user_id AND is_correct = true),
      'share_earnings', (SELECT COALESCE(SUM(reward_amount), 0) FROM user_shares WHERE user_id = p_user_id AND status = 'paid'),
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