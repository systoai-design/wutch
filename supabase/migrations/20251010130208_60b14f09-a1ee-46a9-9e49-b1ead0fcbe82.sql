-- Function to auto-verify admins with blue badge
CREATE OR REPLACE FUNCTION public.auto_verify_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when admin role is granted
  IF NEW.role = 'admin' AND TG_OP = 'INSERT' THEN
    -- Update the user's profile to blue verified
    UPDATE public.profiles
    SET 
      verification_type = 'blue',
      is_verified = true,
      verified_at = COALESCE(verified_at, now()),
      updated_at = now()
    WHERE id = NEW.user_id
    AND (verification_type IS NULL OR verification_type = 'none' OR verification_type = '');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS trigger_auto_verify_admin ON public.user_roles;
CREATE TRIGGER trigger_auto_verify_admin
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.auto_verify_admin();

-- One-time update: Grant blue badge to all existing admins
UPDATE public.profiles p
SET 
  verification_type = 'blue',
  is_verified = true,
  verified_at = COALESCE(verified_at, now()),
  updated_at = now()
FROM public.user_roles ur
WHERE p.id = ur.user_id
AND ur.role = 'admin'
AND (p.verification_type IS NULL OR p.verification_type = 'none' OR p.verification_type = '');