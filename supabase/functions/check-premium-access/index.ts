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

    const { contentType, contentId } = await req.json();

    if (!contentType || !contentId) {
      throw new Error('Missing required fields: contentType, contentId');
    }

    console.log('Checking premium access:', { contentType, contentId, userId: user.id });

    // Get content details
    const tableName = contentType === 'livestream' ? 'livestreams' 
                    : contentType === 'shortvideo' ? 'short_videos'
                    : 'wutch_videos';

    const { data: content, error: contentError } = await supabaseClient
      .from(tableName)
      .select('user_id, x402_price, is_premium')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If content is not premium, grant access
    if (!content.is_premium) {
      return new Response(
        JSON.stringify({
          hasAccess: true,
          isPremium: false,
          isOwner: content.user_id === user.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user is the content owner, grant access
    if (content.user_id === user.id) {
      return new Response(
        JSON.stringify({
          hasAccess: true,
          isPremium: true,
          isOwner: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has purchased access using the database function
    const { data: hasAccess, error: accessError } = await supabaseClient
      .rpc('user_has_premium_access', {
        p_user_id: user.id,
        p_content_type: contentType,
        p_content_id: contentId,
      });

    if (accessError) {
      console.error('Error checking premium access:', accessError);
      throw new Error('Failed to check premium access');
    }

    if (!hasAccess) {
      // Return 402 Payment Required
      return new Response(
        JSON.stringify({
          hasAccess: false,
          isPremium: true,
          isOwner: false,
          price: content.x402_price,
          asset: 'SOL',
          network: 'solana',
          message: 'Payment required to access this premium content',
        }),
        { 
          status: 402, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
            'X-Payment-Amount': content.x402_price.toString(),
            'X-Payment-Asset': 'SOL',
          } 
        }
      );
    }

    // User has access
    return new Response(
      JSON.stringify({
        hasAccess: true,
        isPremium: true,
        isOwner: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-premium-access:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
