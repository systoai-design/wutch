-- Phase 2: Unified Transaction Ledger
-- Create the platform_transactions table as the single source of truth for ALL transactions

CREATE TABLE IF NOT EXISTS public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction classification
  transaction_type TEXT NOT NULL, -- 'x402_purchase', 'share_reward', 'bounty_reward', 'donation', 'service_purchase'
  
  -- Parties involved
  buyer_id UUID REFERENCES auth.users(id), -- NULL for system-initiated payouts
  seller_id UUID REFERENCES auth.users(id) NOT NULL, -- Creator receiving payment
  
  -- Financial details (all in SOL)
  gross_amount NUMERIC NOT NULL CHECK (gross_amount >= 0), -- Total transaction amount
  creator_amount NUMERIC NOT NULL CHECK (creator_amount >= 0), -- Amount to creator
  platform_amount NUMERIC NOT NULL CHECK (platform_amount >= 0), -- Platform fee
  
  -- Blockchain data
  transaction_signature TEXT UNIQUE, -- Solana tx signature
  buyer_wallet TEXT, -- Wallet that sent payment (if applicable)
  seller_wallet TEXT, -- Wallet that received payment
  
  -- Content reference
  content_type TEXT, -- 'livestream', 'shortvideo', 'wutch_video', 'community_post'
  content_id UUID, -- ID of the content
  
  -- Campaign/bounty reference (for rewards)
  campaign_id UUID REFERENCES public.sharing_campaigns(id),
  bounty_id UUID REFERENCES public.stream_bounties(id),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  
  -- Metadata (flexible field for additional data)
  metadata JSONB,
  
  -- Indexes for common queries
  CONSTRAINT valid_split CHECK (gross_amount = creator_amount + platform_amount)
);

-- Create indexes for performance
CREATE INDEX idx_platform_transactions_seller ON public.platform_transactions(seller_id, created_at DESC);
CREATE INDEX idx_platform_transactions_buyer ON public.platform_transactions(buyer_id, created_at DESC);
CREATE INDEX idx_platform_transactions_type ON public.platform_transactions(transaction_type, status);
CREATE INDEX idx_platform_transactions_signature ON public.platform_transactions(transaction_signature);
CREATE INDEX idx_platform_transactions_content ON public.platform_transactions(content_type, content_id);
CREATE INDEX idx_platform_transactions_status_time ON public.platform_transactions(status, confirmed_at DESC);

-- Enable RLS
ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own transactions as seller"
  ON public.platform_transactions FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Users can view their own transactions as buyer"
  ON public.platform_transactions FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Admins can view all transactions"
  ON public.platform_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert transactions"
  ON public.platform_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update transaction status"
  ON public.platform_transactions FOR UPDATE
  USING (true);

-- Analytics Views
CREATE OR REPLACE VIEW public.creator_earnings_summary AS
SELECT 
  seller_id as user_id,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(creator_amount) as total_earned,
  SUM(CASE WHEN status = 'confirmed' THEN creator_amount ELSE 0 END) as confirmed_earned,
  SUM(CASE WHEN status = 'pending' THEN creator_amount ELSE 0 END) as pending_earned,
  MAX(confirmed_at) as last_earning_at
FROM public.platform_transactions
WHERE seller_id IS NOT NULL
GROUP BY seller_id, transaction_type;

CREATE OR REPLACE VIEW public.platform_revenue_summary AS
SELECT 
  transaction_type,
  DATE_TRUNC('day', confirmed_at) as date,
  COUNT(*) as transaction_count,
  SUM(gross_amount) as total_volume,
  SUM(platform_amount) as platform_revenue,
  SUM(creator_amount) as creator_payouts
FROM public.platform_transactions
WHERE status = 'confirmed'
GROUP BY transaction_type, DATE_TRUNC('day', confirmed_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.user_transaction_history AS
SELECT 
  pt.id,
  pt.transaction_type,
  pt.gross_amount,
  pt.creator_amount,
  pt.platform_amount,
  pt.transaction_signature,
  pt.status,
  pt.created_at,
  pt.confirmed_at,
  pt.content_type,
  pt.content_id,
  -- For purchases (user is buyer)
  pt.buyer_id,
  pt.seller_id,
  seller_profile.username as seller_username,
  seller_profile.display_name as seller_display_name,
  seller_profile.avatar_url as seller_avatar_url,
  -- For earnings (user is seller)
  buyer_profile.username as buyer_username,
  buyer_profile.display_name as buyer_display_name
FROM public.platform_transactions pt
LEFT JOIN public.profiles seller_profile ON seller_profile.id = pt.seller_id
LEFT JOIN public.profiles buyer_profile ON buyer_profile.id = pt.buyer_id;

-- Grant access to views
GRANT SELECT ON public.creator_earnings_summary TO authenticated;
GRANT SELECT ON public.user_transaction_history TO authenticated;
GRANT SELECT ON public.platform_revenue_summary TO authenticated;

-- Create function to get user's total earnings from platform_transactions
CREATE OR REPLACE FUNCTION public.get_user_earnings_from_transactions(p_user_id UUID)
RETURNS TABLE(
  total_earned NUMERIC,
  total_confirmed NUMERIC,
  total_pending NUMERIC,
  by_type JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(creator_amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN status = 'confirmed' THEN creator_amount ELSE 0 END), 0) as total_confirmed,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN creator_amount ELSE 0 END), 0) as total_pending,
    jsonb_object_agg(
      transaction_type,
      jsonb_build_object(
        'count', type_count,
        'amount', type_amount
      )
    ) as by_type
  FROM (
    SELECT 
      transaction_type,
      COUNT(*) as type_count,
      SUM(creator_amount) as type_amount
    FROM public.platform_transactions
    WHERE seller_id = p_user_id AND status = 'confirmed'
    GROUP BY transaction_type
  ) type_stats;
END;
$$;