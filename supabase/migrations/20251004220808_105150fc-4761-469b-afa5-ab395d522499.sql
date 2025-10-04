-- Phase 1: Add platform_fees table to track collected fees
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid REFERENCES public.donations(id),
  fee_amount numeric NOT NULL,
  transaction_signature text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on platform_fees
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Only admins can view platform fees
CREATE POLICY "Only admins can view platform fees"
ON public.platform_fees
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 2: Add escrow_transaction_signature to sharing_campaigns
ALTER TABLE public.sharing_campaigns 
ADD COLUMN IF NOT EXISTS escrow_transaction_signature text;

-- Phase 3: Update CPM rates to sustainable levels ($0.10 for both)
UPDATE public.platform_settings 
SET setting_value = jsonb_build_object(
  'livestream', 0.10,
  'shortvideo', 0.10
)
WHERE setting_key = 'cpm_rates';