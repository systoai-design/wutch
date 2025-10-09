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
    // Use service role key to bypass RLS for search
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
      short_videos: [],
      wutch_videos: [],
      profiles: []
    };

    // Search livestreams
    if (type === 'all' || type === 'livestreams') {
      console.log('Searching livestreams for:', query);
      
      // First, find matching profiles
      const { data: matchingProfiles } = await supabaseClient
        .from('public_profiles')
        .select('id')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
      
      const matchingUserIds = matchingProfiles?.map(p => p.id) || [];
      
      // Build the query to search both content and creator
      let livestreamQuery = supabaseClient
        .from('livestreams')
        .select('*');
      
      if (matchingUserIds.length > 0) {
        livestreamQuery = livestreamQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,user_id.in.(${matchingUserIds.join(',')})`);
      } else {
        livestreamQuery = livestreamQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
      }
      
      const { data: livestreams, error: livestreamsError } = await livestreamQuery.limit(10);

      console.log('Livestreams results:', { count: livestreams?.length, error: livestreamsError });
      
      if (livestreams && livestreams.length > 0) {
        const userIds = [...new Set(livestreams.map(s => s.user_id))];
        const { data: profiles } = await supabaseClient
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, banner_url')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        results.livestreams = livestreams.map(stream => ({
          ...stream,
          profiles: profileMap.get(stream.user_id) || null
        }));
      } else {
        results.livestreams = [];
      }
    }

    // Search short videos
    if (type === 'all' || type === 'shorts') {
      console.log('Searching short videos for:', query);
      
      // First, find matching profiles
      const { data: matchingProfiles } = await supabaseClient
        .from('public_profiles')
        .select('id')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
      
      const matchingUserIds = matchingProfiles?.map(p => p.id) || [];
      
      // Build the query to search both content and creator
      let shortsQuery = supabaseClient
        .from('short_videos')
        .select('*');
      
      if (matchingUserIds.length > 0) {
        shortsQuery = shortsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,user_id.in.(${matchingUserIds.join(',')})`);
      } else {
        shortsQuery = shortsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      
      const { data: shorts, error: shortsError } = await shortsQuery.limit(10);

      console.log('Short videos results:', { count: shorts?.length, error: shortsError });
      
      if (shorts && shorts.length > 0) {
        const userIds = [...new Set(shorts.map(s => s.user_id))];
        const { data: profiles } = await supabaseClient
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, banner_url')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        results.short_videos = shorts.map(video => ({
          ...video,
          profiles: profileMap.get(video.user_id) || null
        }));
      } else {
        results.short_videos = [];
      }
    }

    // Search wutch videos
    if (type === 'all' || type === 'wutch') {
      console.log('Searching wutch videos for:', query);
      
      // First, find matching profiles
      const { data: matchingProfiles } = await supabaseClient
        .from('public_profiles')
        .select('id')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
      
      const matchingUserIds = matchingProfiles?.map(p => p.id) || [];
      
      // Build the query to search both content and creator
      let wutchQuery = supabaseClient
        .from('wutch_videos')
        .select('*')
        .eq('status', 'published');
      
      if (matchingUserIds.length > 0) {
        wutchQuery = wutchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%,user_id.in.(${matchingUserIds.join(',')})`);
      } else {
        wutchQuery = wutchQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
      }
      
      const { data: wutchVideos, error: wutchError } = await wutchQuery.limit(10);

      console.log('Wutch videos results:', { count: wutchVideos?.length, error: wutchError });
      
      if (wutchVideos && wutchVideos.length > 0) {
        const userIds = [...new Set(wutchVideos.map(v => v.user_id))];
        const { data: profiles } = await supabaseClient
          .from('public_profiles')
          .select('id, username, display_name, avatar_url, banner_url')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        results.wutch_videos = wutchVideos.map(video => ({
          ...video,
          profiles: profileMap.get(video.user_id) || null
        }));
      } else {
        results.wutch_videos = [];
      }
    }

    // Search users - support both 'users' and 'creators' for backwards compatibility
    if (type === 'all' || type === 'users' || type === 'creators') {
      console.log('Searching profiles for:', query);
      
      const { data: users, error: usersError } = await supabaseClient
        .from('public_profiles')
        .select('id, username, display_name, avatar_url, banner_url, bio, follower_count, is_verified, public_wallet_address')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(10);

      console.log('Profiles search results:', { count: users?.length, error: usersError, sample: users?.[0] });
      
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
