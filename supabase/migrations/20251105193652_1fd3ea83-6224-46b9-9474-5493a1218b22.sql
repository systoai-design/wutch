-- Add tweet_id column to user_shares table
ALTER TABLE user_shares ADD COLUMN IF NOT EXISTS tweet_id TEXT;

-- Create unique constraint to prevent reusing the same tweet for campaign shares
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_shares_campaign_tweet 
ON user_shares(campaign_id, tweet_id) 
WHERE tweet_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_shares.tweet_id IS 'The unique tweet ID from the shared Twitter/X post URL';