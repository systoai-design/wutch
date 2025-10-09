import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { userId } = await req.json();

    if (!userId) {
      throw new Error('User ID required');
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('follower_count')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Calculate watch hours
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from('viewing_sessions')
      .select('total_watch_time')
      .eq('user_id', userId);

    if (sessionsError) throw sessionsError;

    const totalWatchSeconds = sessions.reduce((acc, s) => acc + (s.total_watch_time || 0), 0);
    const totalWatchHours = totalWatchSeconds / 3600;

    const MIN_WATCH_HOURS = 100;
    const MIN_FOLLOWERS = 1000;

    const eligible = totalWatchHours >= MIN_WATCH_HOURS && profile.follower_count >= MIN_FOLLOWERS;

    return new Response(
      JSON.stringify({
        eligible,
        total_watch_hours: parseFloat(totalWatchHours.toFixed(2)),
        required_watch_hours: MIN_WATCH_HOURS,
        follower_count: profile.follower_count,
        required_followers: MIN_FOLLOWERS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
