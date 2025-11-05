-- Add multi-platform support columns to user_shares
ALTER TABLE user_shares 
  ADD COLUMN IF NOT EXISTS platform_user_id TEXT,
  ADD COLUMN IF NOT EXISTS proof_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS post_id TEXT;

-- Add multi-platform support columns to sharing_campaigns
ALTER TABLE sharing_campaigns 
  ADD COLUMN IF NOT EXISTS allowed_platforms TEXT[] DEFAULT ARRAY['twitter']::TEXT[],
  ADD COLUMN IF NOT EXISTS campaign_verification_method TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS require_connected_account BOOLEAN DEFAULT false;

-- Create index for platform verification
CREATE INDEX IF NOT EXISTS idx_user_shares_platform_user 
  ON user_shares(campaign_id, share_platform, platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_shares_post 
  ON user_shares(campaign_id, share_platform, post_id)
  WHERE post_id IS NOT NULL;

-- Create index for review queue
CREATE INDEX IF NOT EXISTS idx_user_shares_review 
  ON user_shares(requires_review, reviewed_by)
  WHERE requires_review = true;

COMMENT ON COLUMN user_shares.platform_user_id IS 'Platform-specific username or user ID from share URL';
COMMENT ON COLUMN user_shares.post_id IS 'Platform-specific post/tweet/video ID';
COMMENT ON COLUMN user_shares.proof_data IS 'Additional proof like screenshots, metadata';
COMMENT ON COLUMN user_shares.verification_method IS 'How it was verified: auto, url_match, connected_account, manual';
COMMENT ON COLUMN user_shares.requires_review IS 'True if creator needs to manually review';
COMMENT ON COLUMN sharing_campaigns.allowed_platforms IS 'Which platforms creator accepts: twitter, facebook, instagram, tiktok';
COMMENT ON COLUMN sharing_campaigns.campaign_verification_method IS 'Default verification for campaign: auto, connected_account, manual';