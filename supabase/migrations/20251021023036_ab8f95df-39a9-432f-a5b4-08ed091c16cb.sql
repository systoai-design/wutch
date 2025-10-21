-- Create escrow transactions tracking table
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payout_bounty', 'payout_share', 'deposit_campaign', 'deposit_fee', 'donation_fee')),
  amount NUMERIC NOT NULL,
  from_wallet TEXT,
  to_wallet TEXT,
  transaction_signature TEXT UNIQUE,
  user_id UUID REFERENCES public.profiles(id),
  bounty_id UUID REFERENCES public.stream_bounties(id),
  campaign_id UUID REFERENCES public.sharing_campaigns(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Add indexes for monitoring and queries
CREATE INDEX idx_escrow_tx_created ON public.escrow_transactions(created_at DESC);
CREATE INDEX idx_escrow_tx_amount ON public.escrow_transactions(amount DESC);
CREATE INDEX idx_escrow_tx_status ON public.escrow_transactions(status);
CREATE INDEX idx_escrow_tx_user ON public.escrow_transactions(user_id, created_at DESC);
CREATE INDEX idx_escrow_tx_type ON public.escrow_transactions(transaction_type);

-- Enable RLS
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view all transactions
CREATE POLICY "Admins can view all escrow transactions"
ON public.escrow_transactions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own transactions
CREATE POLICY "Users can view their own escrow transactions"
ON public.escrow_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can insert transactions
CREATE POLICY "System can insert escrow transactions"
ON public.escrow_transactions
FOR INSERT
WITH CHECK (true);

-- Ensure platform_settings table exists for circuit breaker
CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.platform_settings (setting_key, setting_value)
VALUES 
  ('payouts_enabled', 'true'::jsonb),
  ('max_payout_per_transaction', '5'::jsonb),
  ('max_payout_per_hour_per_user', '10'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.escrow_transactions IS 'Tracks all escrow wallet transactions for security monitoring and auditing';
COMMENT ON TABLE public.platform_settings IS 'Platform-wide settings including security controls and circuit breakers';