
-- CRITICAL SECURITY FIX: Protect verification_requests table from anonymous access
-- This table contains highly sensitive PII and must only be accessible to authenticated users

-- Add a RESTRICTIVE policy that blocks all anonymous access
-- RESTRICTIVE policies use AND logic, so this will be enforced alongside existing policies
CREATE POLICY "Block all anonymous access to verification requests"
ON public.verification_requests
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);

-- Additional safeguard: Ensure INSERT operations also require authentication
-- This prevents any potential bypass of the user_id check
DROP POLICY IF EXISTS "Users can create verification requests" ON public.verification_requests;

CREATE POLICY "Authenticated users can create their own verification requests"
ON public.verification_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Recreate SELECT policies with explicit role restrictions
DROP POLICY IF EXISTS "Users can view own verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.verification_requests;

CREATE POLICY "Authenticated users can view own verification requests"
ON public.verification_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests"
ON public.verification_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate UPDATE policy with explicit role restriction
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;

CREATE POLICY "Admins can update verification requests"
ON public.verification_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment documenting the security model
COMMENT ON TABLE public.verification_requests IS 'CRITICAL SECURITY: Contains highly sensitive PII including identity documents. Access is restricted to: (1) Users can only view/create their own requests, (2) Admins can view/update all requests, (3) Anonymous access is completely blocked by restrictive policy.';
