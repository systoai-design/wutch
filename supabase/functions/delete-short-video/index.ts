import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { shortVideoId } = await req.json();

    if (!shortVideoId) {
      return new Response(
        JSON.stringify({ error: 'Short video ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership or admin status
    const { data: video, error: fetchError } = await supabaseClient
      .from('short_videos')
      .select('user_id')
      .eq('id', shortVideoId)
      .single();

    if (fetchError || !video) {
      return new Response(
        JSON.stringify({ error: 'Short video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!adminRole;

    // Allow deletion if user is owner or admin
    if (video.user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'You can only delete your own content' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete cascade: comments, likes, x402 purchases, views
    await supabaseClient
      .from('comments')
      .delete()
      .eq('content_id', shortVideoId)
      .eq('content_type', 'shortvideo');

    await supabaseClient
      .from('short_video_likes')
      .delete()
      .eq('short_video_id', shortVideoId);

    await supabaseClient
      .from('x402_purchases')
      .delete()
      .eq('content_id', shortVideoId)
      .eq('content_type', 'shortvideo');

    // Delete the short video
    const { error: deleteError } = await supabaseClient
      .from('short_videos')
      .delete()
      .eq('id', shortVideoId);

    if (deleteError) {
      console.error('Error deleting short video:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete short video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Short video deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-short-video function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
