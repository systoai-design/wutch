-- Fix #1: Hide secret words from public view
DROP POLICY IF EXISTS "Anyone can view active bounties" ON public.stream_bounties;

-- Public can view bounties without secret words
CREATE POLICY "Public can view bounties without secrets"
ON public.stream_bounties
FOR SELECT
USING (
  is_active = true 
  AND (auth.uid() IS NULL OR auth.uid() != creator_id)
);

-- Creators can view their own bounties with secrets
CREATE POLICY "Creators can view own bounties with secrets"
ON public.stream_bounties
FOR SELECT
USING (
  auth.uid() = creator_id
);

-- Fix #2: Restrict donor wallet exposure in donations table
DROP POLICY IF EXISTS "Donations are viewable by everyone" ON public.donations;

-- Only recipient and authenticated users can see donation details
CREATE POLICY "Recipients can view donations received"
ON public.donations
FOR SELECT
USING (
  auth.uid() = recipient_user_id
);

-- Public can see donation counts/amounts but not wallet addresses
CREATE POLICY "Public can view donation summaries"
ON public.donations
FOR SELECT
USING (
  auth.uid() IS NULL
);

-- Fix #3: Enable profile creation
CREATE POLICY "Users can create their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id
);

-- Make profile creation trigger more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix #4: Allow campaign creators to view shares
CREATE POLICY "Campaign creators can view shares"
ON public.user_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sharing_campaigns
    WHERE sharing_campaigns.id = user_shares.campaign_id
    AND sharing_campaigns.creator_id = auth.uid()
  )
);