-- Create rate_limits table for API rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limits_check CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System can manage rate limits"
  ON public.rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create signature_nonces table to prevent replay attacks
CREATE TABLE IF NOT EXISTS public.signature_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create index for fast signature lookups
CREATE INDEX IF NOT EXISTS idx_signature_nonces_signature ON public.signature_nonces(signature);
CREATE INDEX IF NOT EXISTS idx_signature_nonces_expires_at ON public.signature_nonces(expires_at);

-- Enable RLS
ALTER TABLE public.signature_nonces ENABLE ROW LEVEL SECURITY;

-- Only system can manage nonces
CREATE POLICY "System can manage signature nonces"
  ON public.signature_nonces
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create twitter_connections table for Twitter OAuth
CREATE TABLE IF NOT EXISTS public.twitter_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  twitter_id TEXT NOT NULL,
  twitter_handle TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(twitter_id)
);

-- Enable RLS
ALTER TABLE public.twitter_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own Twitter connection
CREATE POLICY "Users can view own Twitter connection"
  ON public.twitter_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own Twitter connection
CREATE POLICY "Users can insert own Twitter connection"
  ON public.twitter_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Twitter connection"
  ON public.twitter_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Twitter connection"
  ON public.twitter_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add performance indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_livestreams_status_category ON public.livestreams(status, category) WHERE moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_livestreams_created_at ON public.livestreams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_livestreams_viewer_count ON public.livestreams(viewer_count DESC) WHERE status = 'live';

CREATE INDEX IF NOT EXISTS idx_short_videos_created_at ON public.short_videos(created_at DESC) WHERE moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_short_videos_view_count ON public.short_videos(view_count DESC);

CREATE INDEX IF NOT EXISTS idx_wutch_videos_created_at ON public.wutch_videos(created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_wutch_videos_view_count ON public.wutch_videos(view_count DESC);

-- Cleanup function for expired nonces (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.signature_nonces
  WHERE expires_at < NOW();
END;
$$;

-- Cleanup function for old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;