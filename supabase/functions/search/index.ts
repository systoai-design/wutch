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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type') || 'all';

    console.log('Search request:', { query, type });

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter q is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any = {
      livestreams: [],
      shorts: [],
      wutch_videos: [],
      profiles: []
    };

    // Search livestreams
    if (type === 'all' || type === 'livestreams') {
      const { data: livestreams } = await supabaseClient
        .from('livestreams')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(10);

      results.livestreams = livestreams || [];
    }

    // Search short videos
    if (type === 'all' || type === 'shorts') {
      const { data: shorts } = await supabaseClient
        .from('short_videos')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10);

      results.shorts = shorts || [];
    }

    // Search wutch videos
    if (type === 'all' || type === 'wutch') {
      const { data: wutchVideos } = await supabaseClient
        .from('wutch_videos')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
        .eq('status', 'published')
        .limit(10);

      results.wutch_videos = wutchVideos || [];
    }

    // Search users - support both 'users' and 'creators' for backwards compatibility
    if (type === 'all' || type === 'users' || type === 'creators') {
      console.log('Searching profiles for:', query);
      
      const { data: users, error: usersError } = await supabaseClient
        .from('public_profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(10);

      console.log('Profiles search results:', { count: users?.length, error: usersError });
      
      results.profiles = users || [];
    }

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in search function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
