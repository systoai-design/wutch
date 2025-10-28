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

    // Get user (but allow null for unauthenticated requests)
    const { data: { user } } = await supabaseClient.auth.getUser();

    const { contentType, contentId } = await req.json();

    if (!contentType || !contentId) {
      throw new Error('Missing required fields: contentType, contentId');
    }

    console.log('Checking premium access:', { 
      contentType, 
      contentId, 
      userId: user?.id || 'unauthenticated' 
    });

    // Get content details
    const tableName = contentType === 'livestream' ? 'livestreams' 
                    : contentType === 'shortvideo' ? 'short_videos'
                    : contentType === 'community_post' ? 'community_posts'
                    : 'wutch_videos';

    const { data: content, error: contentError } = await supabaseClient
      .from(tableName)
      .select('user_id, x402_price, is_premium, x402_asset, x402_network, preview_duration')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not authenticated, return premium status but no access
    if (!user) {
      if (content.is_premium) {
        return new Response(JSON.stringify({
          hasAccess: false,
          isPremium: true,
          isOwner: false,
          price: content.x402_price,
          asset: content.x402_asset || 'SOL',
          network: content.x402_network || 'solana',
          previewDuration: content.preview_duration ?? 3,
          message: 'Please sign in to access this premium content',
        }), {
          status: 402,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
          }
        });
      } else {
        return new Response(JSON.stringify({
          hasAccess: true,
          isPremium: false,
          isOwner: false,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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

    // Check if user has purchased access
    let hasAccess = false;
    let accessError = null;

    if (contentType === 'community_post') {
      const result = await supabaseClient
        .rpc('user_has_community_post_access', {
          p_user_id: user.id,
          p_post_id: contentId,
        });
      hasAccess = result.data;
      accessError = result.error;
    } else {
      const result = await supabaseClient
        .rpc('user_has_premium_access', {
          p_user_id: user.id,
          p_content_type: contentType,
          p_content_id: contentId,
        });
      hasAccess = result.data;
      accessError = result.error;
    }

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
          asset: content.x402_asset || 'SOL',
          network: content.x402_network || 'solana',
          previewDuration: content.preview_duration ?? 3,
          message: 'Payment required to access this premium content',
        }),
        { 
          status: 402, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Payment-Required': 'true',
            'X-Payment-Amount': content.x402_price?.toString() || '0',
            'X-Payment-Asset': content.x402_asset || 'SOL',
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
