
-- Fix security definer view by recreating public_profiles with SECURITY INVOKER
-- This ensures the view respects RLS policies of the querying user, not the view creator

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=true) AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  banner_url,
  bio,
  is_verified,
  verification_type,
  verified_at,
  follower_count,
  created_at,
  social_links,
  public_wallet_address,
  promotional_link,
  promotional_link_text
  -- Intentionally excluding sensitive financial data:
  -- total_earnings, pending_earnings, total_donations_received, last_payout_at, updated_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated and anonymous users
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Add comment explaining the security measure
COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles that excludes sensitive financial data (earnings, donations, payouts). Uses SECURITY INVOKER to respect RLS policies. Profile owners should query the profiles table directly to see their financial data.';
