-- Add unique constraint on wallet_address in profiles table
-- This ensures one wallet can only be connected to one account

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_wallet_address_unique UNIQUE (wallet_address);

-- Create an index for better performance on wallet lookups
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address 
ON public.profiles(wallet_address) 
WHERE wallet_address IS NOT NULL;