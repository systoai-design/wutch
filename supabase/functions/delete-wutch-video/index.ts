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

    const { wutchVideoId } = await req.json();

    if (!wutchVideoId) {
      return new Response(
        JSON.stringify({ error: 'Wutch video ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: video, error: fetchError } = await supabaseClient
      .from('wutch_videos')
      .select('user_id')
      .eq('id', wutchVideoId)
      .single();

    if (fetchError || !video) {
      return new Response(
        JSON.stringify({ error: 'Wutch video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (video.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only delete your own content' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete cascade: comments, likes, x402 purchases, view earnings
    await supabaseClient
      .from('comments')
      .delete()
      .eq('content_id', wutchVideoId)
      .eq('content_type', 'wutch_video');

    await supabaseClient
      .from('wutch_video_likes')
      .delete()
      .eq('wutch_video_id', wutchVideoId);

    await supabaseClient
      .from('x402_purchases')
      .delete()
      .eq('content_id', wutchVideoId)
      .eq('content_type', 'wutch_video');

    await supabaseClient
      .from('view_earnings')
      .delete()
      .eq('content_id', wutchVideoId)
      .eq('content_type', 'wutch_video');

    // Delete the wutch video
    const { error: deleteError } = await supabaseClient
      .from('wutch_videos')
      .delete()
      .eq('id', wutchVideoId);

    if (deleteError) {
      console.error('Error deleting wutch video:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete wutch video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Wutch video deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-wutch-video function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
