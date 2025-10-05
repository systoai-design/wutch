-- Phase 0: Add Database Constraints for 1 Account = 1 Wallet

-- Step 1: Clean up any existing duplicate wallet addresses (keep most recent)
DELETE FROM public.profile_wallets a
USING public.profile_wallets b
WHERE a.wallet_address = b.wallet_address
  AND a.created_at < b.created_at;

-- Step 2: Add UNIQUE constraint on wallet_address to enforce 1 wallet = 1 account
ALTER TABLE public.profile_wallets
ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

-- Step 3: Add tracking columns for audit trail
ALTER TABLE public.profile_wallets
ADD COLUMN IF NOT EXISTS first_connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS connection_count INTEGER DEFAULT 1;

-- Step 4: Update existing rows to set first_connected_at from created_at
UPDATE public.profile_wallets
SET first_connected_at = created_at,
    last_connected_at = updated_at
WHERE first_connected_at IS NULL;

-- Step 5: Create trigger function to track reconnections
CREATE OR REPLACE FUNCTION public.track_wallet_reconnection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If wallet_address is being updated (reconnection)
  IF OLD.wallet_address IS DISTINCT FROM NEW.wallet_address THEN
    NEW.first_connected_at := now();
    NEW.last_connected_at := now();
    NEW.connection_count := 1;
  ELSE
    -- Just updating, track last connection
    NEW.last_connected_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Step 6: Create trigger on profile_wallets
DROP TRIGGER IF EXISTS on_wallet_reconnection ON public.profile_wallets;
CREATE TRIGGER on_wallet_reconnection
  BEFORE UPDATE ON public.profile_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.track_wallet_reconnection();

-- Step 7: Add helpful comment
COMMENT ON CONSTRAINT unique_wallet_address ON public.profile_wallets IS 
'Enforces 1 wallet = 1 account rule. Each Solana wallet can only be connected to one Wutch account.';