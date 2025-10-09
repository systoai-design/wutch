-- Create verification codes table for username and email changes
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('username_change', 'email_change')),
  new_value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own codes
CREATE POLICY "Users can view own verification codes"
  ON public.verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert codes (via edge function)
CREATE POLICY "System can insert verification codes"
  ON public.verification_codes
  FOR INSERT
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_type ON public.verification_codes(user_id, type, used);

-- Create trigger to sync livestream status with is_live field
CREATE OR REPLACE FUNCTION sync_livestream_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When is_live changes to true, set status to 'live'
  IF NEW.is_live = true AND OLD.is_live = false THEN
    NEW.status := 'live';
  END IF;
  
  -- When is_live changes to false and stream has ended, set status to 'ended'
  IF NEW.is_live = false AND OLD.is_live = true AND NEW.ended_at IS NOT NULL THEN
    NEW.status := 'ended';
  END IF;
  
  -- When status is manually set to 'live', ensure is_live is true
  IF NEW.status = 'live' AND NEW.is_live = false THEN
    NEW.is_live := true;
  END IF;
  
  -- When status is manually set to 'ended', ensure is_live is false
  IF NEW.status = 'ended' AND NEW.is_live = true THEN
    NEW.is_live := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS sync_livestream_status_trigger ON public.livestreams;
CREATE TRIGGER sync_livestream_status_trigger
  BEFORE UPDATE ON public.livestreams
  FOR EACH ROW
  EXECUTE FUNCTION sync_livestream_status();

-- Clean up inconsistent data
-- Fix streams that are live but status is wrong
UPDATE public.livestreams 
SET status = 'live' 
WHERE is_live = true AND status != 'live';

-- Fix streams that ended but status is still pending
UPDATE public.livestreams 
SET status = 'ended', is_live = false
WHERE ended_at IS NOT NULL AND status != 'ended';

-- Fix streams that are pending but should be live
UPDATE public.livestreams 
SET status = 'live', is_live = true
WHERE status = 'pending' 
  AND started_at IS NOT NULL 
  AND started_at <= NOW()
  AND (ended_at IS NULL OR ended_at > NOW());