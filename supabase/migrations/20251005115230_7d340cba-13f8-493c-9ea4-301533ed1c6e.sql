-- Create bounty_claim_shares table to track required shares before claiming bounties
CREATE TABLE public.bounty_claim_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bounty_id uuid NOT NULL REFERENCES public.stream_bounties(id) ON DELETE CASCADE,
  livestream_id uuid NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  shared_at timestamp with time zone NOT NULL DEFAULT now(),
  share_platform text NOT NULL DEFAULT 'twitter',
  UNIQUE(user_id, bounty_id)
);

-- Enable RLS
ALTER TABLE public.bounty_claim_shares ENABLE ROW LEVEL SECURITY;

-- Users can insert their own shares
CREATE POLICY "Users can create their own shares"
ON public.bounty_claim_shares
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own shares
CREATE POLICY "Users can view their own shares"
ON public.bounty_claim_shares
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Bounty creators can view shares for their bounties
CREATE POLICY "Creators can view shares for their bounties"
ON public.bounty_claim_shares
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stream_bounties
    WHERE stream_bounties.id = bounty_claim_shares.bounty_id
    AND stream_bounties.creator_id = auth.uid()
  )
);