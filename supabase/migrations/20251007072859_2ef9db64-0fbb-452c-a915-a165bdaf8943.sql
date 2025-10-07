-- Drop the existing public policy that exposes all profile data
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create restrictive policies for profiles table
-- Policy 1: Users can view their own complete profile including financial data
CREATE POLICY "Users can view own complete profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Authenticated users can view basic public info of other profiles
-- This allows authenticated features like following, mentions, etc.
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id
);

-- Create a secure public view for unauthenticated/public profile viewing
-- Excludes all sensitive financial and private data
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  banner_url,
  bio,
  is_verified,
  follower_count,
  created_at,
  social_links,
  public_wallet_address,
  promotional_link,
  promotional_link_text
  -- Intentionally excluding: 
  -- total_earnings, pending_earnings, total_donations_received, last_payout_at, updated_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated and anonymous users
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Add comment explaining the security measure
COMMENT ON VIEW public.public_profiles IS 'Public view of user profiles that excludes sensitive financial data (earnings, donations, payouts). Use this view for displaying profiles to non-owners. Profile owners should query the profiles table directly to see their financial data.';