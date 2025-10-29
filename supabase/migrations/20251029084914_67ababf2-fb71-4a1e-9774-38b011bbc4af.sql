-- Update storage bucket configuration for better caching and performance
UPDATE storage.buckets
SET public = true,
    file_size_limit = 524288000,
    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime']
WHERE id = 'wutch-videos';

-- Enable byte-range requests support is handled by Supabase Storage automatically
-- Cache headers need to be configured in the public/_headers file