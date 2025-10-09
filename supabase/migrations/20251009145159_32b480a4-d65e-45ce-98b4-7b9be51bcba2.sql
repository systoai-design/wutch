-- Create admin actions audit log table
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view admin action logs"
  ON public.admin_actions_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert admin action logs"
  ON public.admin_actions_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.admin_actions_log IS 'Audit log for all administrative actions including self-granted badges';

-- Create index for efficient querying
CREATE INDEX idx_admin_actions_log_admin_user_id ON public.admin_actions_log(admin_user_id);
CREATE INDEX idx_admin_actions_log_target_user_id ON public.admin_actions_log(target_user_id);
CREATE INDEX idx_admin_actions_log_action_type ON public.admin_actions_log(action_type);
CREATE INDEX idx_admin_actions_log_created_at ON public.admin_actions_log(created_at DESC);