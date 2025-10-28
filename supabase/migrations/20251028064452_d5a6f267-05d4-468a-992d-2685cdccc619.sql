-- Backfill preview_duration to 3 seconds for all premium shorts where it's null or 0
UPDATE public.short_videos
SET preview_duration = 3
WHERE is_premium = true 
  AND (preview_duration IS NULL OR preview_duration = 0);