-- Create function to increment stream viewers
CREATE OR REPLACE FUNCTION public.increment_stream_viewers(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.livestreams 
  SET viewer_count = viewer_count + 1 
  WHERE id = stream_id;
END;
$function$;

-- Create function to decrement stream viewers
CREATE OR REPLACE FUNCTION public.decrement_stream_viewers(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.livestreams 
  SET viewer_count = GREATEST(0, viewer_count - 1) 
  WHERE id = stream_id;
END;
$function$;