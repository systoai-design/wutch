-- Add health check columns to livestreams table
ALTER TABLE public.livestreams
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stream_duration_hours INTEGER DEFAULT 8;

-- Function to set auto_end_at when stream goes live
CREATE OR REPLACE FUNCTION public.set_stream_auto_end()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'live', calculate auto_end_at
  IF NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live') THEN
    NEW.started_at := NOW();
    NEW.auto_end_at := NOW() + (COALESCE(NEW.stream_duration_hours, 8) || ' hours')::INTERVAL;
    NEW.last_health_check := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-set expiry
DROP TRIGGER IF EXISTS trigger_set_stream_auto_end ON public.livestreams;
CREATE TRIGGER trigger_set_stream_auto_end
  BEFORE INSERT OR UPDATE ON public.livestreams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stream_auto_end();