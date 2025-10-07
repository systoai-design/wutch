-- Drop existing SELECT policy and recreate with more explicit rules
DROP POLICY IF EXISTS "Users can view their own payouts" ON public.payouts;

-- Policy 1: Users can ONLY view their own payout records
CREATE POLICY "Users can view only their own payouts"
ON public.payouts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- Policy 2: Admins can view all payouts (needed to process them)
CREATE POLICY "Admins can view all payouts"
ON public.payouts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Policy 3: Anonymous users explicitly cannot view any payouts
-- This is implicit with no matching policies, but making it explicit for clarity
CREATE POLICY "Anonymous users cannot view payouts"
ON public.payouts
FOR SELECT
TO anon
USING (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.payouts IS 'Payout requests table. RLS enforces strict access: users can only view their own payouts, admins can view all to process them, anonymous users have no access. Exposes sensitive data: wallet_address, amount, transaction_signature.';