-- Drop the existing public view policy that exposes secret words
DROP POLICY IF EXISTS "Public can view bounties without secrets" ON public.stream_bounties;

-- Create a more restrictive public policy that denies access to secret_word
-- Public users should not be able to SELECT from stream_bounties directly
CREATE POLICY "Public cannot view bounties directly"
ON public.stream_bounties
FOR SELECT
USING (false);

-- Keep the creator policy unchanged (they need to see their secret words)
-- The "Creators can view own bounties with secrets" policy remains active

-- Create a secure public view that excludes sensitive columns
CREATE OR REPLACE VIEW public.public_stream_bounties AS
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
COMMENT ON VIEW public.public_stream_bounties IS 'Public view of stream bounties that excludes the secret_word column for security. Use this view for displaying bounties to non-creators.';