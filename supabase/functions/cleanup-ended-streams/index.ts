import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const now = new Date().toISOString();
    
    console.log('Running stream cleanup at:', now);
    
    // Find streams that should have ended (auto_end_at is in the past)
    const { data: staleLivestreams, error: fetchError } = await supabaseClient
      .from('livestreams')
      .select('id, title, started_at, user_id, auto_end_at')
      .eq('status', 'live')
      .lt('auto_end_at', now);

    if (fetchError) {
      console.error('Error fetching stale streams:', fetchError);
      throw fetchError;
    }

    if (!staleLivestreams || staleLivestreams.length === 0) {
      console.log('No stale streams found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stale streams found',
          cleaned: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${staleLivestreams.length} stale streams to clean up`);

    // Update stale streams to 'ended' status
    const { error: updateError } = await supabaseClient
      .from('livestreams')
      .update({
        status: 'ended',
        is_live: false,
        ended_at: now,
        last_health_check: now
      })
      .in('id', staleLivestreams.map(s => s.id));

    if (updateError) {
      console.error('Error updating stale streams:', updateError);
      throw updateError;
    }

    console.log(`Successfully cleaned up ${staleLivestreams.length} stale streams:`, 
      staleLivestreams.map(s => ({ id: s.id, title: s.title }))
    );

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: staleLivestreams.length,
        streams: staleLivestreams.map(s => ({ id: s.id, title: s.title }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-ended-streams:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
