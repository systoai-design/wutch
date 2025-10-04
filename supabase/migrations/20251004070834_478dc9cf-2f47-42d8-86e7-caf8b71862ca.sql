-- Create storage bucket for short videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('short-videos', 'short-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for short video thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('short-thumbnails', 'short-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for short-videos bucket
CREATE POLICY "Users can upload their own short videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'short-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view short videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'short-videos');

CREATE POLICY "Users can update their own short videos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'short-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own short videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'short-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policies for short-thumbnails bucket
CREATE POLICY "Users can upload their own short thumbnails"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'short-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view short thumbnails"
ON storage.objects
FOR SELECT
USING (bucket_id = 'short-thumbnails');

CREATE POLICY "Users can update their own short thumbnails"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'short-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own short thumbnails"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'short-thumbnails' AND
  auth.uid()::text = (storage.foldername(name))[1]
);