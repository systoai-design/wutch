-- Add chapters and transcoding support to wutch_videos table
ALTER TABLE wutch_videos
ADD COLUMN IF NOT EXISTS chapters jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS chapters_vtt_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transcoding_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS hls_playlist_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS available_qualities jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS original_file_size bigint DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transcoded_file_sizes jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS transcoding_started_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transcoding_completed_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transcoding_error text DEFAULT NULL;

-- Add index for transcoding queue
CREATE INDEX IF NOT EXISTS idx_wutch_videos_transcoding_status 
ON wutch_videos(transcoding_status) 
WHERE transcoding_status = 'pending';

-- Add index for chapters query performance
CREATE INDEX IF NOT EXISTS idx_wutch_videos_chapters 
ON wutch_videos USING gin(chapters) 
WHERE chapters IS NOT NULL;

-- Add check constraint for transcoding status
ALTER TABLE wutch_videos
ADD CONSTRAINT check_transcoding_status 
CHECK (transcoding_status IN ('pending', 'processing', 'completed', 'failed'));

COMMENT ON COLUMN wutch_videos.chapters IS 'Array of chapter objects with time and title';
COMMENT ON COLUMN wutch_videos.transcoding_status IS 'Status of video transcoding: pending, processing, completed, failed';
COMMENT ON COLUMN wutch_videos.hls_playlist_url IS 'URL to HLS .m3u8 playlist for adaptive streaming';