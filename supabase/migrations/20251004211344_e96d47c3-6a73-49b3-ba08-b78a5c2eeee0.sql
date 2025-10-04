-- Phase 1: Add promotional_link_text column to profiles, livestreams, and short_videos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS promotional_link_text TEXT DEFAULT 'Check this out!';

ALTER TABLE public.livestreams 
ADD COLUMN IF NOT EXISTS promotional_link_text TEXT DEFAULT 'Check this out!';

ALTER TABLE public.short_videos 
ADD COLUMN IF NOT EXISTS promotional_link_text TEXT DEFAULT 'Check this out!';

-- Phase 2: Update minimum payout from 10 SOL to 1 SOL
UPDATE public.platform_settings
SET setting_value = jsonb_set(setting_value, '{minimum_payout}', '1')
WHERE setting_key = 'payout_settings';