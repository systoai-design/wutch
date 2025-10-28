-- Add preview_duration column to short_videos table
ALTER TABLE public.short_videos 
ADD COLUMN preview_duration INTEGER DEFAULT 3;

COMMENT ON COLUMN public.short_videos.preview_duration IS 'Preview duration in seconds for premium content. Default is 3 seconds. Set to 0 or NULL to disable preview.';