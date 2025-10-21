-- Fix RLS policies for profile_wallets to allow service role operations

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own wallet" ON profile_wallets;

-- Create new INSERT policy that allows both user and service role
CREATE POLICY "Users and service can insert wallet" ON profile_wallets
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR auth.jwt()->>'role' = 'service_role'
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own wallet" ON profile_wallets;

-- Create new UPDATE policy that allows both user and service role
CREATE POLICY "Users and service can update wallet" ON profile_wallets
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR auth.jwt()->>'role' = 'service_role'
);

-- Verify unique constraint exists on user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profile_wallets_user_id_key'
    AND conrelid = 'profile_wallets'::regclass
  ) THEN
    ALTER TABLE profile_wallets 
    ADD CONSTRAINT profile_wallets_user_id_key UNIQUE (user_id);
  END IF;
END
$$;