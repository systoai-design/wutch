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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { type } = await req.json(); // 'buyer' or 'seller'

    console.log('Fetching service orders:', { userId: user.id, type });

    // Fetch orders with post and user details
    const query = supabaseClient
      .from('service_orders')
      .select(`
        *,
        post:community_posts (
          id,
          content,
          service_description,
          delivery_time,
          x402_price,
          media_url
        ),
        buyer:profiles!service_orders_buyer_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        seller:profiles!service_orders_seller_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        purchase:community_post_purchases (
          amount,
          purchased_at,
          transaction_signature
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by user role
    if (type === 'buyer') {
      query.eq('buyer_id', user.id);
    } else if (type === 'seller') {
      query.eq('seller_id', user.id);
    } else {
      // Fetch all orders for the user (both buyer and seller)
      query.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching service orders:', error);
      throw new Error('Failed to fetch service orders');
    }

    console.log(`Found ${orders?.length || 0} service orders`);

    return new Response(
      JSON.stringify({ orders: orders || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-service-orders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});