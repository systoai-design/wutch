-- Update app_role enum to include moderator
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Create content_reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('livestream', 'short_video', 'wutch_video', 'comment')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'violence', 'nsfw', 'misinformation', 'copyright', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create moderation_actions table
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('delete_content', 'warn_user', 'ban_user', 'unban_user', 'resolve_report', 'dismiss_report', 'grant_role', 'revoke_role')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type TEXT CHECK (content_type IN ('livestream', 'short_video', 'wutch_video', 'comment')),
  content_id UUID,
  report_id UUID REFERENCES public.content_reports(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_warnings table
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_reports
CREATE POLICY "Anyone can create reports"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters can view their own reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins and moderators can view all reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can update reports"
  ON public.content_reports FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

-- RLS Policies for moderation_actions
CREATE POLICY "Admins and moderators can view moderation actions"
  ON public.moderation_actions FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can log actions"
  ON public.moderation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = moderator_id AND (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'moderator')
    )
  );

-- RLS Policies for user_warnings
CREATE POLICY "Users can view their own warnings"
  ON public.user_warnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and moderators can view all warnings"
  ON public.user_warnings FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins and moderators can create warnings"
  ON public.user_warnings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = warned_by AND (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'moderator')
    )
  );

-- Update existing delete policies for comments to include moderators
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins and moderators can delete any comment"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

-- Update delete policies for livestreams
DROP POLICY IF EXISTS "Admins can delete any livestream" ON public.livestreams;
CREATE POLICY "Admins and moderators can delete any livestream"
  ON public.livestreams FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

-- Update delete policies for short_videos
DROP POLICY IF EXISTS "Admins can delete any short video" ON public.short_videos;
CREATE POLICY "Admins and moderators can delete any short video"
  ON public.short_videos FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

-- Update delete policies for wutch_videos
DROP POLICY IF EXISTS "Admins can delete any wutch video" ON public.wutch_videos;
CREATE POLICY "Admins and moderators can delete any wutch video"
  ON public.wutch_videos FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'moderator')
  );

-- Helper function to check if user is moderator or admin
CREATE OR REPLACE FUNCTION public.is_moderator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'moderator')
  )
$$;

-- Function to log moderation actions
CREATE OR REPLACE FUNCTION public.log_moderation_action(
  p_action_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_report_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id UUID;
BEGIN
  -- Verify user is admin or moderator
  IF NOT is_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and moderators can log actions';
  END IF;

  INSERT INTO public.moderation_actions (
    moderator_id,
    action_type,
    target_user_id,
    content_type,
    content_id,
    report_id,
    reason,
    notes
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_user_id,
    p_content_type,
    p_content_id,
    p_report_id,
    p_reason,
    p_notes
  ) RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;

-- Function to resolve content reports
CREATE OR REPLACE FUNCTION public.resolve_content_report(
  p_report_id UUID,
  p_status TEXT,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is admin or moderator
  IF NOT is_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and moderators can resolve reports';
  END IF;

  UPDATE public.content_reports
  SET 
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    resolution_notes = p_resolution_notes,
    updated_at = now()
  WHERE id = p_report_id;

  -- Log the action
  PERFORM log_moderation_action(
    CASE 
      WHEN p_status = 'resolved' THEN 'resolve_report'
      ELSE 'dismiss_report'
    END,
    NULL,
    NULL,
    NULL,
    p_report_id,
    NULL,
    p_resolution_notes
  );
END;
$$;

-- Function to manage user roles (admin only)
CREATE OR REPLACE FUNCTION public.manage_user_role(
  p_user_id UUID,
  p_role app_role,
  p_action TEXT -- 'grant' or 'revoke'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can manage roles
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can manage user roles';
  END IF;

  IF p_action = 'grant' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log the action
    PERFORM log_moderation_action(
      'grant_role',
      p_user_id,
      NULL,
      NULL,
      NULL,
      p_role::TEXT,
      'Role granted'
    );
  ELSIF p_action = 'revoke' THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role;
    
    -- Log the action
    PERFORM log_moderation_action(
      'revoke_role',
      p_user_id,
      NULL,
      NULL,
      NULL,
      p_role::TEXT,
      'Role revoked'
    );
  END IF;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON public.content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator ON public.moderation_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id);