-- Fix SECURITY DEFINER views to use SECURITY INVOKER
-- Drop views with CASCADE to remove dependent policies

DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.public_stream_bounties CASCADE;

-- Recreate public_profiles with SECURITY INVOKER
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
  verified_at,
  verification_type,
  follower_count,
  social_links,
  promotional_link,
  promotional_link_text,
  public_wallet_address,
  created_at
FROM public.profiles;

-- Recreate public_stream_bounties with SECURITY INVOKER
CREATE OR REPLACE VIEW public.public_stream_bounties 
WITH (security_invoker=true) AS
SELECT 
  id,
  livestream_id,
  creator_id,
  total_deposit,
  reward_per_participant,
  participant_limit,
  claimed_count,
  is_active,
  expires_at,
  created_at,
  updated_at,
  platform_fee_amount
FROM public.stream_bounties;

-- Recreate the policy that depended on public_stream_bounties
CREATE POLICY "Public can view livestreams with bounties"
ON public.livestreams
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM public.public_stream_bounties
    WHERE public_stream_bounties.livestream_id = livestreams.id
    AND public_stream_bounties.is_active = true
  )) OR (auth.uid() IS NOT NULL)
);