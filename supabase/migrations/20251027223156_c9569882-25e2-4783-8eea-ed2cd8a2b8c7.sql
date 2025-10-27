-- Add x402 premium fields to community_posts table
ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS x402_price NUMERIC,
ADD COLUMN IF NOT EXISTS x402_asset TEXT DEFAULT 'SOL',
ADD COLUMN IF NOT EXISTS x402_network TEXT DEFAULT 'solana',
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS service_description TEXT,
ADD COLUMN IF NOT EXISTS delivery_time TEXT;

-- Add check constraint for minimum price
ALTER TABLE community_posts
ADD CONSTRAINT check_x402_price_minimum CHECK (x402_price IS NULL OR x402_price >= 0.001);

-- Create community_post_purchases table
CREATE TABLE IF NOT EXISTS community_post_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  asset TEXT NOT NULL DEFAULT 'SOL',
  network TEXT NOT NULL DEFAULT 'solana',
  payment_proof JSONB,
  transaction_signature TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS on community_post_purchases
ALTER TABLE community_post_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_post_purchases
CREATE POLICY "Users can view own purchases"
ON community_post_purchases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sellers can view purchases of their posts"
ON community_post_purchases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM community_posts
    WHERE community_posts.id = community_post_purchases.post_id
    AND community_posts.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert purchases"
ON community_post_purchases FOR INSERT
WITH CHECK (true);

-- Create service_orders table
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES community_post_purchases(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  delivery_note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on service_orders
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_orders
CREATE POLICY "Buyers can view their orders"
ON service_orders FOR SELECT
USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view their orders"
ON service_orders FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "System can insert orders"
ON service_orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sellers can update their orders"
ON service_orders FOR UPDATE
USING (auth.uid() = seller_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_service_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_service_orders_updated_at
BEFORE UPDATE ON service_orders
FOR EACH ROW
EXECUTE FUNCTION update_service_order_updated_at();

-- Create function to check if user has purchased a community post
CREATE OR REPLACE FUNCTION user_has_community_post_access(p_user_id UUID, p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM community_post_purchases
    WHERE user_id = p_user_id
      AND post_id = p_post_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_community_post_purchases_user_post ON community_post_purchases(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_buyer ON service_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_seller ON service_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_post_type ON community_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_premium ON community_posts(is_premium);