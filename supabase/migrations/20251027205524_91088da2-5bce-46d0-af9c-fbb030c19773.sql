-- Phase 1: x402 Premium Content Database Schema

-- Add premium content columns to livestreams
ALTER TABLE public.livestreams
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS x402_price NUMERIC(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS x402_asset TEXT DEFAULT 'SOL',
ADD COLUMN IF NOT EXISTS x402_network TEXT DEFAULT 'solana';

-- Add premium content columns to short_videos
ALTER TABLE public.short_videos
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS x402_price NUMERIC(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS x402_asset TEXT DEFAULT 'SOL',
ADD COLUMN IF NOT EXISTS x402_network TEXT DEFAULT 'solana';

-- Add premium content columns to wutch_videos
ALTER TABLE public.wutch_videos
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS x402_price NUMERIC(10,4) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS x402_asset TEXT DEFAULT 'SOL',
ADD COLUMN IF NOT EXISTS x402_network TEXT DEFAULT 'solana';

-- Create x402_purchases table
CREATE TABLE IF NOT EXISTS public.x402_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('livestream', 'shortvideo', 'wutch_video')),
  content_id UUID NOT NULL,
  amount NUMERIC(10,4) NOT NULL,
  asset TEXT NOT NULL DEFAULT 'SOL',
  network TEXT NOT NULL DEFAULT 'solana',
  payment_proof TEXT NOT NULL,
  transaction_signature TEXT NOT NULL UNIQUE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_x402_purchases_user_id ON public.x402_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_x402_purchases_content ON public.x402_purchases(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_x402_purchases_active ON public.x402_purchases(is_active, user_id);
CREATE INDEX IF NOT EXISTS idx_x402_purchases_transaction ON public.x402_purchases(transaction_signature);

-- Create index on premium content
CREATE INDEX IF NOT EXISTS idx_livestreams_premium ON public.livestreams(is_premium) WHERE is_premium = true;
CREATE INDEX IF NOT EXISTS idx_short_videos_premium ON public.short_videos(is_premium) WHERE is_premium = true;
CREATE INDEX IF NOT EXISTS idx_wutch_videos_premium ON public.wutch_videos(is_premium) WHERE is_premium = true;

-- Enable RLS on x402_purchases
ALTER TABLE public.x402_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
ON public.x402_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Content creators can view purchases of their content
CREATE POLICY "Creators can view purchases of their content"
ON public.x402_purchases
FOR SELECT
USING (
  (content_type = 'livestream' AND EXISTS (
    SELECT 1 FROM public.livestreams WHERE id = content_id AND user_id = auth.uid()
  )) OR
  (content_type = 'shortvideo' AND EXISTS (
    SELECT 1 FROM public.short_videos WHERE id = content_id AND user_id = auth.uid()
  )) OR
  (content_type = 'wutch_video' AND EXISTS (
    SELECT 1 FROM public.wutch_videos WHERE id = content_id AND user_id = auth.uid()
  ))
);

-- RLS Policy: System can insert purchases (via edge function)
CREATE POLICY "System can insert purchases"
ON public.x402_purchases
FOR INSERT
WITH CHECK (true);

-- RLS Policy: Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.x402_purchases
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to check if user has active purchase
CREATE OR REPLACE FUNCTION public.user_has_premium_access(
  p_user_id UUID,
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.x402_purchases
    WHERE user_id = p_user_id
      AND content_type = p_content_type
      AND content_id = p_content_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$;

-- Create function to record x402 platform fee
CREATE OR REPLACE FUNCTION public.record_x402_fee(
  p_amount NUMERIC,
  p_content_id UUID,
  p_content_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_fees (fee_amount, fee_source, source_id, created_at)
  VALUES (p_amount, 'x402_' || p_content_type, p_content_id, NOW());
  
  -- Update revenue pool if it exists
  UPDATE public.platform_revenue_pool
  SET total_collected = total_collected + p_amount,
      available_balance = available_balance + p_amount,
      last_updated = NOW()
  WHERE EXISTS (SELECT 1 FROM public.platform_revenue_pool LIMIT 1);
END;
$$;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_x402_purchases_updated_at
BEFORE UPDATE ON public.x402_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();