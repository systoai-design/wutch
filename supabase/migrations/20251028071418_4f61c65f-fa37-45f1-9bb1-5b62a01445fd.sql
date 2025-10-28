-- Add public read policy for profile_wallets to enable X402 payments
-- Creator wallets need to be publicly readable so buyers can send payments

CREATE POLICY "Public can view wallet addresses for payments"
  ON profile_wallets FOR SELECT
  USING (true);

COMMENT ON POLICY "Public can view wallet addresses for payments" ON profile_wallets IS 
'Allows anyone to read wallet addresses for X402 payment purposes. This is necessary for premium content purchases where buyers need to know the creator wallet address to send SOL payments.';