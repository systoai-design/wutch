-- Create table to track red badge eligibility notifications
CREATE TABLE IF NOT EXISTS public.red_badge_eligibility_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  was_eligible BOOLEAN NOT NULL DEFAULT true,
  follower_count INTEGER NOT NULL,
  watch_hours NUMERIC NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.red_badge_eligibility_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own eligibility notifications"
  ON public.red_badge_eligibility_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert eligibility notifications"
  ON public.red_badge_eligibility_notifications
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_red_badge_notifications_user_id ON public.red_badge_eligibility_notifications(user_id);