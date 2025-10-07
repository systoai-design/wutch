-- Create a function to get aggregated platform stats without exposing individual earnings
CREATE OR REPLACE FUNCTION public.get_platform_earnings_stats()
RETURNS TABLE (
  total_paid_to_creators numeric,
  active_creators bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(total_earnings + pending_earnings), 0) as total_paid_to_creators,
    COUNT(DISTINCT id) FILTER (WHERE total_earnings > 0 OR pending_earnings > 0) as active_creators
  FROM public.profiles;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_platform_earnings_stats() TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION public.get_platform_earnings_stats() IS 'Returns aggregated platform earnings statistics without exposing individual user earnings. Safe for public display on landing page.';