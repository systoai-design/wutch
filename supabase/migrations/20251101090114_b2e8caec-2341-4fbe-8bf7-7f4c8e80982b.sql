-- Add HLS playlist URL column to short_videos table for adaptive streaming support
ALTER TABLE public.short_videos 
ADD COLUMN IF NOT EXISTS hls_playlist_url text;

-- Add index for faster lookups when filtering by HLS availability
CREATE INDEX IF NOT EXISTS idx_short_videos_hls_playlist_url 
ON public.short_videos(hls_playlist_url) 
WHERE hls_playlist_url IS NOT NULL;