-- Make livestream_id nullable for polymorphic content support
ALTER TABLE sharing_campaigns 
  ALTER COLUMN livestream_id DROP NOT NULL;

-- Add polymorphic content columns
ALTER TABLE sharing_campaigns
  ADD COLUMN content_type TEXT NOT NULL DEFAULT 'livestream',
  ADD COLUMN content_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Add constraint to ensure content_type is valid
ALTER TABLE sharing_campaigns
  ADD CONSTRAINT valid_content_type 
  CHECK (content_type IN ('livestream', 'short_video', 'wutch_video'));

-- Create index for faster lookups
CREATE INDEX idx_sharing_campaigns_content 
  ON sharing_campaigns(content_type, content_id);

-- Migrate existing data: Set content_id from livestream_id and content_type to 'livestream'
UPDATE sharing_campaigns 
SET content_id = livestream_id, 
    content_type = 'livestream'
WHERE livestream_id IS NOT NULL;

-- Update RLS policies to work with polymorphic content
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON sharing_campaigns;
DROP POLICY IF EXISTS "Creators can create their own campaigns" ON sharing_campaigns;
DROP POLICY IF EXISTS "Creators can update their own campaigns" ON sharing_campaigns;
DROP POLICY IF EXISTS "Creators can delete their own campaigns" ON sharing_campaigns;

-- View active campaigns (any content type)
CREATE POLICY "Anyone can view active campaigns"
ON sharing_campaigns FOR SELECT
USING (is_active = true);

-- Creators can create campaigns for their own content
CREATE POLICY "Creators can create their own campaigns"
ON sharing_campaigns FOR INSERT
WITH CHECK (
  auth.uid() = creator_id AND (
    (content_type = 'livestream' AND EXISTS (
      SELECT 1 FROM livestreams WHERE id = content_id AND user_id = auth.uid()
    )) OR
    (content_type = 'short_video' AND EXISTS (
      SELECT 1 FROM short_videos WHERE id = content_id AND user_id = auth.uid()
    )) OR
    (content_type = 'wutch_video' AND EXISTS (
      SELECT 1 FROM wutch_videos WHERE id = content_id AND user_id = auth.uid()
    ))
  )
);

-- Creators can update their own campaigns
CREATE POLICY "Creators can update their own campaigns"
ON sharing_campaigns FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can delete their own campaigns
CREATE POLICY "Creators can delete their own campaigns"
ON sharing_campaigns FOR DELETE
USING (auth.uid() = creator_id);