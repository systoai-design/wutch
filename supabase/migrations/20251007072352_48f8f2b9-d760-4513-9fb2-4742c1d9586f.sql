-- Recreate the view with SECURITY INVOKER to respect RLS policies
CREATE OR REPLACE VIEW public.public_stream_bounties 
WITH (security_invoker=on) AS
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
  platform_fee_amount,
  created_at,
  updated_at
  -- Intentionally excluding: secret_word
FROM public.stream_bounties
WHERE is_active = true;

-- Grant SELECT on the view to authenticated and anonymous users
GRANT SELECT ON public.public_stream_bounties TO authenticated, anon;

-- Add a comment explaining the security measure
COMMENT ON VIEW public.public_stream_bounties IS 'Public view of stream bounties that excludes the secret_word column for security. Uses SECURITY INVOKER to respect RLS policies. Use this view for displaying bounties to non-creators.';