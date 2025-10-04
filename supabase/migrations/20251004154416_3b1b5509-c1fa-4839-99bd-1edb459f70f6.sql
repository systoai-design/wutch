-- Fix wallet address security issue by removing public exposure
-- and adding opt-in public wallet for donations

-- Step 1: Add public_wallet_address column for users who want to accept donations
ALTER TABLE public.profiles 
ADD COLUMN public_wallet_address text;

-- Step 2: Migrate existing wallet addresses to profile_wallets if they don't exist
-- This ensures no data loss
INSERT INTO public.profile_wallets (user_id, wallet_address)
SELECT id, wallet_address 
FROM public.profiles 
WHERE wallet_address IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Remove the insecure wallet_address column from profiles
ALTER TABLE public.profiles 
DROP COLUMN wallet_address;

-- Step 4: Add helpful comment
COMMENT ON COLUMN public.profiles.public_wallet_address IS 'Optional: Public wallet address for receiving donations. Users must explicitly set this if they want to accept tips.';

-- Step 5: Ensure profile_wallets has proper unique constraint
ALTER TABLE public.profile_wallets 
DROP CONSTRAINT IF EXISTS profile_wallets_user_id_key;

ALTER TABLE public.profile_wallets 
ADD CONSTRAINT profile_wallets_user_id_key UNIQUE (user_id);