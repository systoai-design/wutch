-- Fix 1: Remove public access to donations table to protect donor wallet addresses
DROP POLICY IF EXISTS "Public can view donation summaries" ON public.donations;

-- Add policy for donors to view their own donations
CREATE POLICY "Donors can view their own donations"
ON public.donations
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profile_wallets 
    WHERE wallet_address = donor_wallet_address
  )
);

-- Fix 2: Add explicit documentation to bounty_claims policies
COMMENT ON POLICY "Users can view their own claims" ON public.bounty_claims IS 
'Users can only view bounty claims they created. No cross-user access allowed to protect wallet addresses and transaction data.';

COMMENT ON TABLE public.bounty_claims IS 
'Stores bounty claim attempts with wallet addresses. RLS ensures users can only access their own claims to prevent wallet harvesting.';

-- Fix 3: Strengthen profile_wallets policies with explicit ownership requirements
DROP POLICY IF EXISTS "Users can view own wallet" ON public.profile_wallets;

CREATE POLICY "Only owner can view wallet"
ON public.profile_wallets
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- Add explicit security documentation
COMMENT ON TABLE public.profile_wallets IS 
'Private wallet storage. Each user can only access their own wallet record. No public or cross-user access allowed.';

COMMENT ON POLICY "Only owner can view wallet" ON public.profile_wallets IS 
'Wallet addresses are highly sensitive. Only the wallet owner (matching auth.uid) can view their own wallet.';

COMMENT ON POLICY "Users can insert own wallet" ON public.profile_wallets IS 
'Users can only create wallet records for their own account.';

COMMENT ON POLICY "Users can update own wallet" ON public.profile_wallets IS 
'Users can only update their own wallet records.';