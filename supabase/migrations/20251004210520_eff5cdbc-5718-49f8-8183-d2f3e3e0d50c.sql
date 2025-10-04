-- Add earnings columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN pending_earnings numeric DEFAULT 0 NOT NULL,
ADD COLUMN total_earnings numeric DEFAULT 0 NOT NULL,
ADD COLUMN last_payout_at timestamp with time zone;

-- Create view_earnings table to track earnings per view
CREATE TABLE public.view_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type content_type NOT NULL,
  content_id uuid NOT NULL,
  earnings_amount numeric NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_view_earnings_user_id ON public.view_earnings(user_id);
CREATE INDEX idx_view_earnings_content ON public.view_earnings(content_type, content_id);

-- Create payouts table to track payout history
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  wallet_address text NOT NULL,
  transaction_signature text,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  notes text
);

-- Create index for faster queries
CREATE INDEX idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);

-- Create platform settings table for CPM rates
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default CPM rates (cost per 1000 views)
INSERT INTO public.platform_settings (setting_key, setting_value) VALUES
('cpm_rates', '{"livestream": 2.0, "shortvideo": 1.5, "default": 1.0}'::jsonb),
('platform_fee', '{"percentage": 0.05, "description": "5% platform fee on donations"}'::jsonb),
('minimum_payout', '{"amount": 10, "currency": "SOL"}'::jsonb);

-- Enable RLS on new tables
ALTER TABLE public.view_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for view_earnings
CREATE POLICY "Users can view their own earnings" 
ON public.view_earnings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert earnings" 
ON public.view_earnings 
FOR INSERT 
WITH CHECK (true);

-- RLS policies for payouts
CREATE POLICY "Users can view their own payouts" 
ON public.payouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can request payouts" 
ON public.payouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update payouts" 
ON public.payouts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for platform_settings
CREATE POLICY "Anyone can view platform settings" 
ON public.platform_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can update platform settings" 
ON public.platform_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to calculate and credit earnings
CREATE OR REPLACE FUNCTION public.credit_view_earnings(
  p_user_id uuid,
  p_content_type content_type,
  p_content_id uuid,
  p_view_count integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpm_rate numeric;
  v_earnings numeric;
BEGIN
  -- Get CPM rate for content type
  SELECT (setting_value->>p_content_type::text)::numeric 
  INTO v_cpm_rate
  FROM public.platform_settings 
  WHERE setting_key = 'cpm_rates';
  
  -- Default to 1.0 if not found
  IF v_cpm_rate IS NULL THEN
    v_cpm_rate := 1.0;
  END IF;
  
  -- Calculate earnings (CPM / 1000 * view_count)
  v_earnings := (v_cpm_rate / 1000.0) * p_view_count;
  
  -- Record earnings
  INSERT INTO public.view_earnings (user_id, content_type, content_id, earnings_amount, view_count)
  VALUES (p_user_id, p_content_type, p_content_id, v_earnings, p_view_count);
  
  -- Update profile pending earnings
  UPDATE public.profiles 
  SET pending_earnings = pending_earnings + v_earnings
  WHERE id = p_user_id;
END;
$$;

-- Function to process payout
CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id uuid,
  p_transaction_signature text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout RECORD;
BEGIN
  -- Get payout details
  SELECT * INTO v_payout FROM public.payouts WHERE id = p_payout_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout not found';
  END IF;
  
  IF v_payout.status != 'pending' THEN
    RAISE EXCEPTION 'Payout already processed';
  END IF;
  
  -- Update payout status
  UPDATE public.payouts
  SET status = 'completed',
      transaction_signature = p_transaction_signature,
      processed_at = now()
  WHERE id = p_payout_id;
  
  -- Update profile earnings
  UPDATE public.profiles
  SET pending_earnings = GREATEST(0, pending_earnings - v_payout.amount),
      total_earnings = total_earnings + v_payout.amount,
      last_payout_at = now()
  WHERE id = v_payout.user_id;
END;
$$;