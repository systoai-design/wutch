-- Add promotional_link column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN promotional_link text;

-- Add promotional_link column to livestreams table
ALTER TABLE public.livestreams 
ADD COLUMN promotional_link text;

-- Add promotional_link column to short_videos table
ALTER TABLE public.short_videos 
ADD COLUMN promotional_link text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.promotional_link IS 'Optional promotional/affiliate link for the user profile';
COMMENT ON COLUMN public.livestreams.promotional_link IS 'Optional promotional/affiliate link for the livestream';
COMMENT ON COLUMN public.short_videos.promotional_link IS 'Optional promotional/affiliate link for the short video';