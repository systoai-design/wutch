-- Create creator subscription tiers table
CREATE TABLE public.creator_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  tier_description TEXT,
  price_monthly NUMERIC(10,4) NOT NULL,
  price_asset TEXT NOT NULL DEFAULT 'SOL',
  access_level TEXT NOT NULL DEFAULT 'all_content',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, tier_name)
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.creator_subscriptions(id) ON DELETE CASCADE,
  transaction_signature TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  last_payment_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_creator_subscriptions_creator ON public.creator_subscriptions(creator_id, is_active);
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id, is_active);
CREATE INDEX idx_user_subscriptions_expires ON public.user_subscriptions(expires_at, is_active);
CREATE INDEX idx_user_subscriptions_subscription ON public.user_subscriptions(subscription_id, is_active);

-- Enable RLS
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator_subscriptions
CREATE POLICY "Anyone can view active subscription tiers"
ON public.creator_subscriptions FOR SELECT
USING (is_active = true);

CREATE POLICY "Creators can manage their subscription tiers"
ON public.creator_subscriptions FOR ALL
USING (auth.uid() = creator_id);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Creators can view their subscribers"
ON public.user_subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.creator_subscriptions cs
    WHERE cs.id = user_subscriptions.subscription_id
    AND cs.creator_id = auth.uid()
  )
);

CREATE POLICY "System can insert subscriptions"
ON public.user_subscriptions FOR INSERT
WITH CHECK (true);

-- Update the user_has_premium_access function to check subscriptions
CREATE OR REPLACE FUNCTION public.user_has_premium_access(
  p_user_id UUID,
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_has_subscription BOOLEAN;
  v_has_one_time_purchase BOOLEAN;
BEGIN
  -- Get content creator
  IF p_content_type = 'livestream' THEN
    SELECT user_id INTO v_creator_id FROM public.livestreams WHERE id = p_content_id;
  ELSIF p_content_type = 'shortvideo' THEN
    SELECT user_id INTO v_creator_id FROM public.short_videos WHERE id = p_content_id;
  ELSIF p_content_type = 'wutch_video' THEN
    SELECT user_id INTO v_creator_id FROM public.wutch_videos WHERE id = p_content_id;
  END IF;

  -- Check for active subscription
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions us
    JOIN public.creator_subscriptions cs ON cs.id = us.subscription_id
    WHERE us.user_id = p_user_id
      AND cs.creator_id = v_creator_id
      AND us.is_active = true
      AND us.expires_at > NOW()
      AND (
        cs.access_level = 'all_content' OR
        (cs.access_level = 'streams_only' AND p_content_type = 'livestream') OR
        (cs.access_level = 'shorts_only' AND p_content_type = 'shortvideo') OR
        (cs.access_level = 'videos_only' AND p_content_type = 'wutch_video')
      )
  ) INTO v_has_subscription;

  -- Check for one-time purchase
  SELECT EXISTS (
    SELECT 1 FROM public.x402_purchases
    WHERE user_id = p_user_id
      AND content_type = p_content_type
      AND content_id = p_content_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_has_one_time_purchase;

  RETURN (v_has_subscription OR v_has_one_time_purchase);
END;
$$;

-- Add trigger for updated_at on creator_subscriptions
CREATE TRIGGER update_creator_subscriptions_updated_at
BEFORE UPDATE ON public.creator_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();