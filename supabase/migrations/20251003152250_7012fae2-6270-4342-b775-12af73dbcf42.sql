-- Create sharing campaigns table (creators set rewards for shares)
CREATE TABLE public.sharing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  livestream_id UUID NOT NULL REFERENCES public.livestreams(id) ON DELETE CASCADE,
  reward_per_share NUMERIC NOT NULL DEFAULT 0.005,
  total_budget NUMERIC NOT NULL,
  spent_budget NUMERIC NOT NULL DEFAULT 0,
  max_shares_per_user INTEGER DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT positive_reward CHECK (reward_per_share >= 0.005),
  CONSTRAINT valid_budget CHECK (total_budget > 0 AND spent_budget <= total_budget)
);

-- Create user shares/earnings table
CREATE TABLE public.user_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.sharing_campaigns(id) ON DELETE CASCADE,
  share_platform TEXT NOT NULL DEFAULT 'twitter',
  share_url TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_signature TEXT,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'paid', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.sharing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sharing_campaigns
CREATE POLICY "Anyone can view active campaigns"
ON public.sharing_campaigns FOR SELECT
USING (is_active = true);

CREATE POLICY "Creators can create their own campaigns"
ON public.sharing_campaigns FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own campaigns"
ON public.sharing_campaigns FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own campaigns"
ON public.sharing_campaigns FOR DELETE
USING (auth.uid() = creator_id);

-- RLS Policies for user_shares
CREATE POLICY "Users can view their own shares"
ON public.user_shares FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create shares"
ON public.user_shares FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to update campaign budget when share is created
CREATE OR REPLACE FUNCTION public.update_campaign_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  campaign RECORD;
BEGIN
  -- Get campaign details
  SELECT * INTO campaign FROM public.sharing_campaigns WHERE id = NEW.campaign_id;
  
  -- Check if campaign has budget
  IF campaign.spent_budget + NEW.reward_amount > campaign.total_budget THEN
    RAISE EXCEPTION 'Campaign has insufficient budget';
  END IF;
  
  -- Check max shares per user if set
  IF campaign.max_shares_per_user IS NOT NULL THEN
    DECLARE
      user_share_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO user_share_count 
      FROM public.user_shares 
      WHERE user_id = NEW.user_id AND campaign_id = NEW.campaign_id;
      
      IF user_share_count >= campaign.max_shares_per_user THEN
        RAISE EXCEPTION 'User has reached maximum shares for this campaign';
      END IF;
    END;
  END IF;
  
  -- Update spent budget
  UPDATE public.sharing_campaigns 
  SET spent_budget = spent_budget + NEW.reward_amount,
      is_active = CASE 
        WHEN (spent_budget + NEW.reward_amount) >= total_budget THEN false
        ELSE is_active
      END
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update budget on new share
CREATE TRIGGER on_user_share_created
  BEFORE INSERT ON public.user_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_budget();

-- Trigger for updated_at on sharing_campaigns
CREATE TRIGGER update_sharing_campaigns_updated_at
  BEFORE UPDATE ON public.sharing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_sharing_campaigns_creator ON public.sharing_campaigns(creator_id);
CREATE INDEX idx_sharing_campaigns_livestream ON public.sharing_campaigns(livestream_id);
CREATE INDEX idx_sharing_campaigns_active ON public.sharing_campaigns(is_active);
CREATE INDEX idx_user_shares_user ON public.user_shares(user_id);
CREATE INDEX idx_user_shares_campaign ON public.user_shares(campaign_id);
CREATE INDEX idx_user_shares_status ON public.user_shares(status);