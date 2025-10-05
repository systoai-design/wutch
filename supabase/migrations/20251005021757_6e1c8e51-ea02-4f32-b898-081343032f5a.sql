-- Phase 1: Add platform fee tracking to bounties and campaigns
ALTER TABLE public.stream_bounties 
ADD COLUMN IF NOT EXISTS platform_fee_amount numeric DEFAULT 0 NOT NULL;

ALTER TABLE public.sharing_campaigns 
ADD COLUMN IF NOT EXISTS platform_fee_amount numeric DEFAULT 0 NOT NULL;

-- Phase 2: Enhance platform_fees table to track fee sources
ALTER TABLE public.platform_fees 
ADD COLUMN IF NOT EXISTS fee_source text CHECK (fee_source IN ('donation', 'bounty', 'campaign')),
ADD COLUMN IF NOT EXISTS source_id uuid;

-- Phase 3: Create platform revenue pool system
CREATE TABLE IF NOT EXISTS public.platform_revenue_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_collected numeric NOT NULL DEFAULT 0,
  total_paid_for_views numeric NOT NULL DEFAULT 0,
  available_balance numeric NOT NULL DEFAULT 0,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  settings jsonb NOT NULL DEFAULT '{"cpm_rates": {"livestream": 0.10, "short_video": 0.10}, "min_balance_threshold": 100}'::jsonb
);

-- Insert initial revenue pool record
INSERT INTO public.platform_revenue_pool (id, total_collected, total_paid_for_views, available_balance)
VALUES (gen_random_uuid(), 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Phase 4: Add tracking to view_earnings
ALTER TABLE public.view_earnings
ADD COLUMN IF NOT EXISTS funded_by_pool boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pool_balance_at_time numeric;

-- Phase 5: Create function to add fees to revenue pool
CREATE OR REPLACE FUNCTION public.add_to_revenue_pool(
  p_amount numeric,
  p_fee_source text,
  p_source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the revenue pool
  UPDATE public.platform_revenue_pool
  SET total_collected = total_collected + p_amount,
      available_balance = available_balance + p_amount,
      last_updated = now();
  
  -- Record the fee
  INSERT INTO public.platform_fees (fee_amount, fee_source, source_id, created_at)
  VALUES (p_amount, p_fee_source, p_source_id, now());
END;
$$;

-- Phase 6: Update credit_view_earnings to use revenue pool
CREATE OR REPLACE FUNCTION public.credit_view_earnings(
  p_user_id uuid,
  p_content_type content_type,
  p_content_id uuid,
  p_view_count integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpm_rate numeric;
  v_earnings numeric;
  v_pool_balance numeric;
  v_pool_settings jsonb;
BEGIN
  -- Get revenue pool balance and settings
  SELECT available_balance, settings 
  INTO v_pool_balance, v_pool_settings
  FROM public.platform_revenue_pool
  LIMIT 1;
  
  -- If no pool exists or balance is insufficient, exit without crediting
  IF v_pool_balance IS NULL OR v_pool_balance <= 0 THEN
    RAISE NOTICE 'Platform revenue pool has insufficient balance. View earnings disabled.';
    RETURN;
  END IF;
  
  -- Get CPM rate for content type from pool settings
  v_cpm_rate := (v_pool_settings->'cpm_rates'->>p_content_type::text)::numeric;
  
  -- Default to 0.10 if not found
  IF v_cpm_rate IS NULL THEN
    v_cpm_rate := 0.10;
  END IF;
  
  -- Calculate earnings (CPM / 1000 * view_count)
  v_earnings := (v_cpm_rate / 1000.0) * p_view_count;
  
  -- Check if pool can cover this earning
  IF v_earnings > v_pool_balance THEN
    RAISE NOTICE 'Insufficient pool balance for view earnings';
    RETURN;
  END IF;
  
  -- Deduct from revenue pool
  UPDATE public.platform_revenue_pool
  SET total_paid_for_views = total_paid_for_views + v_earnings,
      available_balance = available_balance - v_earnings,
      last_updated = now();
  
  -- Record earnings
  INSERT INTO public.view_earnings (
    user_id, 
    content_type, 
    content_id, 
    earnings_amount, 
    view_count,
    funded_by_pool,
    pool_balance_at_time
  )
  VALUES (
    p_user_id, 
    p_content_type, 
    p_content_id, 
    v_earnings, 
    p_view_count,
    true,
    v_pool_balance
  );
  
  -- Update profile pending earnings
  UPDATE public.profiles 
  SET pending_earnings = pending_earnings + v_earnings
  WHERE id = p_user_id;
END;
$$;

-- Phase 7: Add RLS policy for revenue pool (admins only)
ALTER TABLE public.platform_revenue_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view revenue pool"
ON public.platform_revenue_pool
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update revenue pool"
ON public.platform_revenue_pool
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));