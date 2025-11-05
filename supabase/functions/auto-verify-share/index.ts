import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  campaignId: string;
  shareUrl?: string;
  platform?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, code: 'auth_error', message: 'Please sign in to share' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, code: 'auth_error', message: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { campaignId, shareUrl, platform = 'twitter' } = await req.json() as RequestBody;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ ok: false, code: 'invalid_request', message: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('sharing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ ok: false, code: 'campaign_not_found', message: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if campaign is active
    if (!campaign.is_active) {
      return new Response(
        JSON.stringify({ ok: false, code: 'campaign_inactive', message: 'This campaign is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check budget
    const remainingBudget = campaign.total_budget - campaign.spent_budget;
    if (remainingBudget < campaign.reward_per_share) {
      return new Response(
        JSON.stringify({ ok: false, code: 'budget_exhausted', message: 'This campaign has run out of budget' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user share limit
    if (campaign.max_shares_per_user) {
      const { count } = await supabase
        .from('user_shares')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('campaign_id', campaignId);

      if (count && count >= campaign.max_shares_per_user) {
        return new Response(
          JSON.stringify({ ok: false, code: 'limit_reached', message: 'You\'ve reached the share limit for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing share
    const { data: existingShare } = await supabase
      .from('user_shares')
      .select('id')
      .eq('user_id', user.id)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (existingShare) {
      return new Response(
        JSON.stringify({ ok: false, code: 'already_shared', message: 'You\'re already qualified for this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's connected social accounts
    const { data: profile } = await supabase
      .from('profiles')
      .select('social_links')
      .eq('id', user.id)
      .single();

    const platformHandle = profile?.social_links?.[platform] || null;
    const twitterHandle = profile?.social_links?.twitter || null;

    // Insert verified share
    const { data: share, error: insertError } = await supabase
      .from('user_shares')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        share_platform: platform,
        share_url: shareUrl || null,
        platform_user_id: platformHandle,
        post_id: null,
        tweet_id: null, // Backward compat
        twitter_handle: platform === 'twitter' ? twitterHandle : null, // Backward compat
        reward_amount: campaign.reward_per_share,
        status: 'verified',
        verified_at: new Date().toISOString(),
        verification_method: 'auto',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);

      // Map database errors
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ ok: false, code: 'already_shared', message: 'You\'re already qualified for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (insertError.message.includes('insufficient budget') || insertError.message.includes('Campaign has insufficient budget')) {
        return new Response(
          JSON.stringify({ ok: false, code: 'budget_exhausted', message: 'This campaign has run out of budget' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (insertError.message.includes('maximum shares') || insertError.message.includes('reached maximum shares')) {
        return new Response(
          JSON.stringify({ ok: false, code: 'limit_reached', message: 'You\'ve reached the share limit for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (insertError.code === '42501') {
        return new Response(
          JSON.stringify({ ok: false, code: 'auth_error', message: 'Permission denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, code: 'unknown', message: 'Failed to verify share' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, share }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auto-verify error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, code: 'unknown', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
