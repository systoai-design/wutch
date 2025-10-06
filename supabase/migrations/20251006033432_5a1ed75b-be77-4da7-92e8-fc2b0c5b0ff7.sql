-- Add indexes to optimize share campaign and bounty lookups
CREATE INDEX IF NOT EXISTS idx_sharing_campaigns_livestream_active 
ON public.sharing_campaigns(livestream_id, is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_stream_bounties_livestream_active 
ON public.stream_bounties(livestream_id, is_active)
WHERE is_active = true;

-- Add index for viewing sessions to improve watch time queries
CREATE INDEX IF NOT EXISTS idx_viewing_sessions_user_livestream 
ON public.viewing_sessions(user_id, livestream_id, is_active);

-- Add index for user shares to improve campaign analytics
CREATE INDEX IF NOT EXISTS idx_user_shares_campaign_status 
ON public.user_shares(campaign_id, status, is_claimed);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_sharing_campaigns_livestream_active IS 'Optimizes queries for active share campaigns per livestream';
COMMENT ON INDEX idx_stream_bounties_livestream_active IS 'Optimizes queries for active bounties per livestream';
COMMENT ON INDEX idx_viewing_sessions_user_livestream IS 'Optimizes watch time calculations per user and livestream';
COMMENT ON INDEX idx_user_shares_campaign_status IS 'Optimizes campaign analytics and payout queries';