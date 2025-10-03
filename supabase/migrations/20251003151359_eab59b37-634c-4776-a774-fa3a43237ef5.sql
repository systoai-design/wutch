-- Function to increment user total donations
CREATE OR REPLACE FUNCTION increment_user_donations(
  user_id UUID,
  donation_amount DECIMAL(20, 9)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET total_donations_received = total_donations_received + donation_amount
  WHERE id = user_id;
END;
$$;