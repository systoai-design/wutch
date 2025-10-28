-- Clean slate: Delete all shorts, wutch videos, and livestreams with their associated data
-- This preserves user accounts, profiles, and system tables

-- 1. Delete comments on content
DELETE FROM comments WHERE content_type IN ('shortvideo', 'wutch_video', 'livestream');

-- 2. Delete all likes
DELETE FROM wutch_video_likes;
DELETE FROM short_video_likes;
DELETE FROM livestream_likes;

-- 3. Delete user shares first, then campaigns
DELETE FROM user_shares WHERE campaign_id IN (
  SELECT id FROM sharing_campaigns WHERE content_type IN ('short_video', 'wutch_video', 'livestream')
);
DELETE FROM sharing_campaigns WHERE content_type IN ('short_video', 'wutch_video', 'livestream');

-- 4. Delete bounty claims, then bounties
DELETE FROM bounty_claims WHERE bounty_id IN (SELECT id FROM stream_bounties);
DELETE FROM stream_bounties;

-- 5. Delete donations to content
DELETE FROM donations WHERE content_type IN ('shortvideo', 'wutch_video', 'livestream');

-- 6. Delete platform transactions linked to content
DELETE FROM platform_transactions WHERE content_type IN ('short_video', 'wutch_video', 'livestream');

-- 7. Delete content moderation records
DELETE FROM content_moderation WHERE content_type IN ('short_video', 'wutch_video', 'livestream');

-- 8. Finally delete the main content tables
DELETE FROM short_videos;
DELETE FROM wutch_videos;
DELETE FROM livestreams;