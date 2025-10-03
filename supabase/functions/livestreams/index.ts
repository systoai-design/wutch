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
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    
    // GET /livestreams or /livestreams/:id
    if (req.method === 'GET') {
      const id = path[path.length - 1];
      
      if (id && id !== 'livestreams') {
        // Get single livestream
        const { data, error } = await supabaseClient
          .from('livestreams')
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url,
              wallet_address
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List livestreams with filters
      const filter = url.searchParams.get('filter');
      const category = url.searchParams.get('category');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      let query = supabaseClient
        .from('livestreams')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            wallet_address
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filter === 'live') {
        query = query.eq('is_live', true);
      } else if (filter === 'trending') {
        query = query
          .eq('is_live', true)
          .order('viewer_count', { ascending: false })
          .order('total_donations', { ascending: false });
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ data, count, page, limit }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /livestreams - Create new livestream
    if (req.method === 'POST') {
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json();
      
      const { data, error } = await supabaseClient
        .from('livestreams')
        .insert({
          user_id: user.id,
          pump_fun_url: body.pumpFunUrl,
          title: body.title,
          description: body.description,
          thumbnail_url: body.thumbnailUrl,
          category: body.category,
          tags: body.tags || [],
          is_live: false,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /livestreams/:id - Update livestream
    if (req.method === 'PUT') {
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const id = path[path.length - 1];
      const body = await req.json();

      const { data, error } = await supabaseClient
        .from('livestreams')
        .update({
          title: body.title,
          description: body.description,
          thumbnail_url: body.thumbnailUrl,
          category: body.category,
          tags: body.tags,
          is_live: body.isLive,
          viewer_count: body.viewerCount,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /livestreams/:id
    if (req.method === 'DELETE') {
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const id = path[path.length - 1];

      const { error } = await supabaseClient
        .from('livestreams')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in livestreams function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
