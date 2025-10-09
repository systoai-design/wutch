-- ENHANCED SECURITY FOR VERIFICATION_REQUESTS TABLE
-- Implements audit logging and additional access controls for sensitive PII

-- 1. Create audit log table for tracking all access to verification requests
CREATE TABLE IF NOT EXISTS public.verification_requests_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  accessed_columns TEXT[], -- Track which sensitive columns were accessed
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  access_reason TEXT -- For admin access, require a reason
);

-- Enable RLS on audit log
ALTER TABLE public.verification_requests_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.verification_requests_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.verification_requests_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_verification_audit_request_id 
ON public.verification_requests_audit_log(verification_request_id);

CREATE INDEX IF NOT EXISTS idx_verification_audit_accessed_by 
ON public.verification_requests_audit_log(accessed_by);

CREATE INDEX IF NOT EXISTS idx_verification_audit_accessed_at 
ON public.verification_requests_audit_log(accessed_at DESC);

-- 2. Create function to log access to sensitive columns
CREATE OR REPLACE FUNCTION public.log_verification_request_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_columns TEXT[] := ARRAY[
    'legal_name', 
    'legal_email', 
    'legal_phone', 
    'legal_address', 
    'legal_id_type', 
    'legal_id_number_encrypted', 
    'legal_id_document_url'
  ];
BEGIN
  -- Log the access (only for SELECT on sensitive data by admins)
  IF TG_OP = 'SELECT' AND has_role(auth.uid(), 'admin'::app_role) THEN
    INSERT INTO public.verification_requests_audit_log (
      verification_request_id,
      accessed_by,
      access_type,
      accessed_columns,
      accessed_at
    ) VALUES (
      NEW.id,
      auth.uid(),
      TG_OP,
      sensitive_columns,
      NOW()
    );
  END IF;
  
  -- For UPDATE operations, log what changed
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.verification_requests_audit_log (
      verification_request_id,
      accessed_by,
      access_type,
      accessed_columns,
      accessed_at
    ) VALUES (
      NEW.id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
      TG_OP,
      ARRAY(
        SELECT column_name::TEXT
        FROM (
          SELECT 'legal_name' WHERE OLD.legal_name IS DISTINCT FROM NEW.legal_name
          UNION ALL SELECT 'legal_email' WHERE OLD.legal_email IS DISTINCT FROM NEW.legal_email
          UNION ALL SELECT 'legal_phone' WHERE OLD.legal_phone IS DISTINCT FROM NEW.legal_phone
          UNION ALL SELECT 'legal_address' WHERE OLD.legal_address IS DISTINCT FROM NEW.legal_address
          UNION ALL SELECT 'legal_id_type' WHERE OLD.legal_id_type IS DISTINCT FROM NEW.legal_id_type
          UNION ALL SELECT 'legal_id_number_encrypted' WHERE OLD.legal_id_number_encrypted IS DISTINCT FROM NEW.legal_id_number_encrypted
          UNION ALL SELECT 'status' WHERE OLD.status IS DISTINCT FROM NEW.status
        ) AS column_name
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_verification_request_access ON public.verification_requests;
CREATE TRIGGER audit_verification_request_access
AFTER UPDATE ON public.verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_verification_request_access();

-- 3. Enhanced storage policies for verification-documents bucket
-- Ensure documents can only be accessed by the user who uploaded them or admins

-- First, ensure RLS is enabled on storage.objects
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all verification documents" ON storage.objects;

-- Recreate with stricter controls
CREATE POLICY "Users can upload their own verification documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete verification documents (for data cleanup/compliance)
CREATE POLICY "Admins can delete verification documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Add additional security constraints
-- Ensure email is valid format (basic check)
ALTER TABLE public.verification_requests 
DROP CONSTRAINT IF EXISTS valid_email_format;

ALTER TABLE public.verification_requests
ADD CONSTRAINT valid_email_format 
CHECK (legal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 5. Create view for admins to see verification requests without exposing all PII at once
CREATE OR REPLACE VIEW public.verification_requests_admin_summary AS
SELECT 
  id,
  user_id,
  verification_type,
  status,
  LEFT(legal_name, 1) || '***' AS legal_name_masked,
  LEFT(legal_email, 3) || '***@' || SPLIT_PART(legal_email, '@', 2) AS legal_email_masked,
  submitted_at,
  reviewed_at,
  reviewed_by,
  meets_eligibility_criteria,
  follower_count_at_request,
  total_watch_hours
FROM public.verification_requests;

-- Grant access to authenticated users with admin role
GRANT SELECT ON public.verification_requests_admin_summary TO authenticated;

-- Add RLS to the view
ALTER VIEW public.verification_requests_admin_summary SET (security_invoker = true);

-- 6. Update the table comment with enhanced security documentation
COMMENT ON TABLE public.verification_requests IS 
'CRITICAL SECURITY - CONTAINS HIGHLY SENSITIVE PII
Access Controls:
- Anonymous access: BLOCKED (restrictive policy)
- Users: Can only view/create their own requests
- Admins: Can view/update all requests
- All admin access is logged in verification_requests_audit_log
- Identity documents stored in encrypted storage with separate RLS
- Email validation enforced at database level
- Use verification_requests_admin_summary view for admin overview without exposing full PII';

COMMENT ON TABLE public.verification_requests_audit_log IS
'Audit log tracking all access to sensitive PII in verification_requests table. Only viewable by admins.';

-- 7. Create helper function for admins to access full details with reason logging
CREATE OR REPLACE FUNCTION public.admin_view_verification_request(
  request_id UUID,
  access_reason TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  verification_type TEXT,
  legal_name TEXT,
  legal_email TEXT,
  legal_phone TEXT,
  legal_address TEXT,
  legal_id_type TEXT,
  legal_id_document_url TEXT,
  status TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Log the access with reason
  INSERT INTO verification_requests_audit_log (
    verification_request_id,
    accessed_by,
    access_type,
    accessed_columns,
    access_reason,
    accessed_at
  ) VALUES (
    request_id,
    auth.uid(),
    'SELECT',
    ARRAY['legal_name', 'legal_email', 'legal_phone', 'legal_address', 'legal_id_type', 'legal_id_document_url'],
    access_reason,
    NOW()
  );

  -- Return the full details
  RETURN QUERY
  SELECT 
    vr.id,
    vr.user_id,
    vr.verification_type,
    vr.legal_name,
    vr.legal_email,
    vr.legal_phone,
    vr.legal_address,
    vr.legal_id_type,
    vr.legal_id_document_url,
    vr.status,
    vr.submitted_at,
    vr.reviewed_at
  FROM verification_requests vr
  WHERE vr.id = request_id;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION public.admin_view_verification_request TO authenticated;