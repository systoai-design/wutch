-- Add RLS policy to allow public viewing of livestreams with bounties
-- This allows unauthenticated users to see streams with active bounties on the landing page
-- without being able to claim them (bounty claiming still requires authentication)

CREATE POLICY "Public can view livestreams with bounties"
ON public.livestreams
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.public_stream_bounties
    WHERE public_stream_bounties.livestream_id = livestreams.id
      AND public_stream_bounties.is_active = true
  )
  OR auth.uid() IS NOT NULL
);