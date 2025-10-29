-- Allow anyone (including unauthenticated users) to view public profile information
CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
TO public
USING (true);