-- Create verification_requests table
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('blue', 'red')),
  
  -- Payment Info (for blue badge)
  payment_transaction_signature TEXT,
  payment_amount NUMERIC DEFAULT 0.05,
  payment_wallet_address TEXT,
  payment_verified_at TIMESTAMPTZ,
  
  -- Legal Information
  legal_name TEXT NOT NULL,
  legal_email TEXT NOT NULL,
  legal_phone TEXT,
  legal_address TEXT,
  legal_id_type TEXT,
  legal_id_number_encrypted TEXT,
  legal_id_document_url TEXT,
  
  -- Eligibility Info (for red badge)
  total_watch_hours NUMERIC,
  follower_count_at_request INTEGER,
  meets_eligibility_criteria BOOLEAN DEFAULT FALSE,
  
  -- Request Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  
  -- Audit Trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, verification_type)
);

CREATE INDEX idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);
CREATE INDEX idx_verification_requests_type ON verification_requests(verification_type);

-- Update profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS verification_type TEXT CHECK (verification_type IN ('none', 'blue', 'red')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Update existing verified users to have blue badge
UPDATE profiles SET verification_type = 'blue' WHERE is_verified = true;
UPDATE profiles SET verification_type = 'none' WHERE is_verified = false OR is_verified IS NULL;

-- Enable RLS
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own verification requests"
  ON verification_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create verification requests"
  ON verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests"
  ON verification_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update verification requests"
  ON verification_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Create update_profile_verification function
CREATE OR REPLACE FUNCTION update_profile_verification(
  p_user_id UUID,
  p_verification_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET 
    verification_type = p_verification_type,
    is_verified = (p_verification_type IN ('blue', 'red')),
    verified_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-documents' AND
    has_role(auth.uid(), 'admin')
  );

-- Add to platform revenue pool when badge payment verified
CREATE OR REPLACE FUNCTION add_to_revenue_pool(
  p_amount NUMERIC,
  p_fee_source TEXT,
  p_source_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE platform_revenue_pool
  SET total_collected = total_collected + p_amount,
      available_balance = available_balance + p_amount,
      last_updated = NOW();
  
  INSERT INTO platform_fees (fee_amount, fee_source, source_id, created_at)
  VALUES (p_amount, p_fee_source, p_source_id, NOW());
END;
$$;

-- Create notification function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata);
END;
$$;