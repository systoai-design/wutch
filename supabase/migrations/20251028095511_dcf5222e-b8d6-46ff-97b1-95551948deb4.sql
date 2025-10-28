-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_platform_earnings_stats();

-- Create updated function with X402 premium earnings
CREATE OR REPLACE FUNCTION public.get_platform_earnings_stats()
RETURNS TABLE (
  total_paid_to_creators numeric,
  active_creators bigint,
  x402_premium_earnings numeric,
  x402_active_creators bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Total from profiles (view earnings, bounties, shares, donations)
    COALESCE(SUM(total_earnings + pending_earnings), 0) 
    + 
    -- Add X402 premium earnings
    COALESCE((
      SELECT SUM(creator_amount) 
      FROM platform_transactions 
      WHERE transaction_type = 'x402_purchase' 
        AND status = 'confirmed'
        AND seller_id IS NOT NULL
    ), 0) as total_paid_to_creators,
    
    -- Active creators (have any earnings)
    COUNT(DISTINCT id) FILTER (
      WHERE total_earnings > 0 OR pending_earnings > 0
    ) as active_creators,
    
    -- X402 premium earnings only
    COALESCE((
      SELECT SUM(creator_amount) 
      FROM platform_transactions 
      WHERE transaction_type = 'x402_purchase' 
        AND status = 'confirmed'
        AND seller_id IS NOT NULL
    ), 0) as x402_premium_earnings,
    
    -- Creators with X402 sales
    (
      SELECT COUNT(DISTINCT seller_id)
      FROM platform_transactions
      WHERE transaction_type = 'x402_purchase'
        AND status = 'confirmed'
        AND seller_id IS NOT NULL
    ) as x402_active_creators
    
  FROM public.profiles;
$$;