-- Create viewing_sessions table to track watch time
CREATE TABLE public.viewing_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  livestream_id UUID NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_watch_time INTEGER NOT NULL DEFAULT 0, -- in seconds
  is_active BOOLEAN NOT NULL DEFAULT true,
  tab_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.viewing_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sessions"
  ON public.viewing_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.viewing_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.viewing_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_viewing_sessions_user_livestream 
  ON public.viewing_sessions(user_id, livestream_id);

CREATE INDEX idx_viewing_sessions_active 
  ON public.viewing_sessions(is_active, last_active_at);

-- Update bounty_claims table to add watch time verification
ALTER TABLE public.bounty_claims
  ADD COLUMN watch_time_seconds INTEGER DEFAULT 0,
  ADD COLUMN meets_watch_requirement BOOLEAN DEFAULT false;

-- Function to calculate total watch time for a user on a stream
CREATE OR REPLACE FUNCTION public.get_user_watch_time(
  p_user_id UUID,
  p_livestream_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_seconds INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_watch_time), 0)
  INTO total_seconds
  FROM public.viewing_sessions
  WHERE user_id = p_user_id
    AND livestream_id = p_livestream_id;
  
  RETURN total_seconds;
END;
$$;

-- Update the bounty claim trigger to verify watch time
CREATE OR REPLACE FUNCTION public.process_bounty_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounty RECORD;
  user_watch_time INTEGER;
  min_watch_time INTEGER := 300; -- 5 minutes minimum watch time
BEGIN
  -- Get bounty details
  SELECT * INTO bounty FROM public.stream_bounties WHERE id = NEW.bounty_id;
  
  -- Check if bounty is active
  IF NOT bounty.is_active THEN
    RAISE EXCEPTION 'Bounty is no longer active';
  END IF;
  
  -- Check if participant limit reached
  IF bounty.claimed_count >= bounty.participant_limit THEN
    RAISE EXCEPTION 'Participant limit reached';
  END IF;
  
  -- Check if expired
  IF bounty.expires_at IS NOT NULL AND bounty.expires_at < now() THEN
    RAISE EXCEPTION 'Bounty has expired';
  END IF;
  
  -- Get user's total watch time for this stream
  user_watch_time := public.get_user_watch_time(NEW.user_id, bounty.livestream_id);
  NEW.watch_time_seconds := user_watch_time;
  
  -- Check minimum watch time requirement
  IF user_watch_time < min_watch_time THEN
    NEW.meets_watch_requirement := false;
    NEW.is_correct := false;
    NEW.reward_amount := 0;
    RAISE EXCEPTION 'Minimum watch time not met. You need % minutes of watch time.', (min_watch_time / 60);
  END IF;
  
  NEW.meets_watch_requirement := true;
  
  -- Verify secret word (case-insensitive)
  IF LOWER(TRIM(NEW.submitted_word)) = LOWER(TRIM(bounty.secret_word)) THEN
    NEW.is_correct := true;
    NEW.reward_amount := bounty.reward_per_participant;
    
    -- Update claimed count
    UPDATE public.stream_bounties 
    SET claimed_count = claimed_count + 1,
        is_active = CASE 
          WHEN (claimed_count + 1) >= participant_limit THEN false
          ELSE is_active
        END
    WHERE id = NEW.bounty_id;
  ELSE
    NEW.is_correct := false;
    NEW.reward_amount := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to mark old sessions as inactive (cleanup)
CREATE OR REPLACE FUNCTION public.deactivate_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark sessions as inactive if no activity for 2 minutes
  UPDATE public.viewing_sessions
  SET is_active = false
  WHERE is_active = true
    AND last_active_at < now() - INTERVAL '2 minutes';
END;
$$;