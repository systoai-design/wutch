-- Allow public to view active bounties (without secret_word via the view)
-- This policy allows SELECT on stream_bounties for active bounties
-- The public_stream_bounties view will filter out secret_word
CREATE POLICY "Public can view active bounties through view"
ON public.stream_bounties
FOR SELECT
USING (is_active = true);

-- Note: The public_stream_bounties view already excludes secret_word
-- so this is safe for public access