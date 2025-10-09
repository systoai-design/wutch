-- Drop and recreate public_profiles view with verification fields
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  follower_count,
  is_verified,
  social_links,
  banner_url,
  created_at,
  promotional_link,
  promotional_link_text,
  public_wallet_address,
  verification_type,
  verified_at
FROM profiles;