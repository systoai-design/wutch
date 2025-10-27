-- Add seller statistics to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_rating_avg NUMERIC(3,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_rating_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_orders_completed INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_response_time_hours INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_completion_rate INTEGER;

-- Create service reviews table
CREATE TABLE service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  response_text TEXT,
  response_at TIMESTAMPTZ,
  is_verified_purchase BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, order_id)
);

ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON service_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create reviews after order completion"
  ON service_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id AND
    EXISTS (
      SELECT 1 FROM service_orders 
      WHERE id = order_id 
      AND buyer_id = auth.uid() 
      AND status = 'completed'
    )
  );

CREATE POLICY "Buyers can update own reviews"
  ON service_reviews FOR UPDATE
  USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can respond to reviews"
  ON service_reviews FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (response_text IS NOT NULL);

-- Create direct message threads table
CREATE TABLE direct_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  buyer_unread_count INTEGER DEFAULT 0,
  seller_unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);

ALTER TABLE direct_message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view threads"
  ON direct_message_threads FOR SELECT
  USING (auth.uid() IN (buyer_id, seller_id));

CREATE POLICY "System can create threads"
  ON direct_message_threads FOR INSERT
  WITH CHECK (true);

-- Create direct messages table
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES direct_message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view messages"
  ON direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_message_threads 
      WHERE id = thread_id 
      AND auth.uid() IN (buyer_id, seller_id)
    )
  );

CREATE POLICY "Thread participants can send messages"
  ON direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM direct_message_threads 
      WHERE id = thread_id 
      AND auth.uid() IN (buyer_id, seller_id)
    )
  );

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- Create service disputes table
CREATE TABLE service_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id),
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  resolution TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispute participants can view disputes"
  ON service_disputes FOR SELECT
  USING (
    auth.uid() = raised_by OR
    EXISTS (
      SELECT 1 FROM service_orders 
      WHERE id = order_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    ) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Order participants can create disputes"
  ON service_disputes FOR INSERT
  WITH CHECK (
    auth.uid() = raised_by AND
    EXISTS (
      SELECT 1 FROM service_orders 
      WHERE id = order_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- Add service verification fields to verification_requests
ALTER TABLE verification_requests 
  ADD COLUMN IF NOT EXISTS is_service_seller BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_categories TEXT[],
  ADD COLUMN IF NOT EXISTS portfolio_links TEXT[],
  ADD COLUMN IF NOT EXISTS business_registration TEXT;

-- Add service category to community_posts
ALTER TABLE community_posts 
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_images TEXT[],
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- Trigger to auto-update seller stats on review
CREATE OR REPLACE FUNCTION update_seller_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    service_rating_avg = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM service_reviews
      WHERE seller_id = NEW.seller_id
    ),
    service_rating_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE seller_id = NEW.seller_id
    )
  WHERE id = NEW.seller_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_seller_stats_on_review
  AFTER INSERT OR UPDATE ON service_reviews
  FOR EACH ROW EXECUTE FUNCTION update_seller_stats();

-- Trigger to update completion stats
CREATE OR REPLACE FUNCTION update_seller_completion_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    service_orders_completed = (
      SELECT COUNT(*)
      FROM service_orders
      WHERE seller_id = NEW.seller_id AND status = 'completed'
    ),
    service_completion_rate = (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed')::float / 
         NULLIF(COUNT(*), 0) * 100)::numeric, 0
      )
      FROM service_orders
      WHERE seller_id = NEW.seller_id
    )
  WHERE id = NEW.seller_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_seller_completion_stats_on_order
  AFTER UPDATE ON service_orders
  FOR EACH ROW 
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_seller_completion_stats();

-- Trigger to auto-create message thread on order creation
CREATE OR REPLACE FUNCTION create_message_thread_on_order()
RETURNS TRIGGER AS $$
DECLARE
  thread_id_var UUID;
BEGIN
  INSERT INTO direct_message_threads (order_id, buyer_id, seller_id)
  VALUES (NEW.id, NEW.buyer_id, NEW.seller_id)
  RETURNING id INTO thread_id_var;
  
  INSERT INTO direct_messages (thread_id, sender_id, message_text)
  VALUES (
    thread_id_var,
    NEW.seller_id,
    'Hi! Thanks for your order. I''ll start working on it shortly. Feel free to message me if you have any questions!'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_thread_on_new_order
  AFTER INSERT ON service_orders
  FOR EACH ROW EXECUTE FUNCTION create_message_thread_on_order();