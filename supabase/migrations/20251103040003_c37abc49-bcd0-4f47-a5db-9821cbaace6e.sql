-- Fix public_profiles view to include verified_at and other missing columns
DROP VIEW IF EXISTS public_profiles CASCADE;

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
  verified_at,
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