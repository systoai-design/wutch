-- Add twitter account tracking and claim status to user_shares
ALTER TABLE public.user_shares 
ADD COLUMN IF NOT EXISTS twitter_handle text,
ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Create unique constraint to prevent same Twitter account from sharing multiple times for same campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_shares_campaign_twitter 
ON public.user_shares(campaign_id, twitter_handle) 
WHERE twitter_handle IS NOT NULL;

-- Add index for efficient claim queries
CREATE INDEX IF NOT EXISTS idx_user_shares_unclaimed 
ON public.user_shares(user_id, is_claimed) 
WHERE is_claimed = false;

-- Update status field to include 'claimed' status
COMMENT ON COLUMN public.user_shares.status IS 'Share status: pending (just shared), verified (confirmed valid), claimed (reward paid out)';
COMMENT ON COLUMN public.user_shares.twitter_handle IS 'Twitter/X handle to prevent duplicate shares from same account';
COMMENT ON COLUMN public.user_shares.is_claimed IS 'Whether the reward has been claimed and paid out';