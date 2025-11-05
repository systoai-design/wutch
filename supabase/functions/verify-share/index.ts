import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyShareRequest {
  campaignId: string;
  shareUrl: string;
  platform: string;
  expectedHandle?: string;
}

interface VerifyShareResponse {
  ok: boolean;
  code?: string;
  message?: string;
  details?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ ok: false, code: 'auth_error', message: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { campaignId, shareUrl, platform, expectedHandle }: VerifyShareRequest = await req.json();

    console.log('Verifying share:', { userId: user.id, campaignId, shareUrl, platform });

    // Import URL parser
    const { parseShareUrl } = await import('./urlParsers.ts');
    
    // Parse the share URL
    const parsed = parseShareUrl(shareUrl, platform);
    
    if (!parsed.isValid) {
      console.error('Invalid URL format:', shareUrl, parsed.error);
      return new Response(
        JSON.stringify({ ok: false, code: 'invalid_url', message: parsed.error || 'Invalid share URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If platform_user_id is missing but expectedHandle provided, use it
    let platformUserId = parsed.platform_user_id || expectedHandle || null;
    const postId = parsed.post_id;

    if (!postId) {
      console.error('No post ID found:', shareUrl);
      return new Response(
        JSON.stringify({ ok: false, code: 'invalid_url', message: 'Could not extract post ID from URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed share:', { postId, platformUserId, platform });

    // Get user's connected social accounts from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('social_links')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ ok: false, code: 'auth_error', message: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get platform-specific handle
    const connectedHandle = profile.social_links?.[platform]?.replace('@', '').toLowerCase();
    
    // Determine verification method
    let verificationMethod = 'auto';
    let requiresReview = false;

    if (platformUserId && connectedHandle) {
      // Verify username matches connected account
      const normalizedUserId = platformUserId.toLowerCase();
      if (normalizedUserId !== connectedHandle) {
        console.error('Author mismatch:', { normalizedUserId, connectedHandle, platform });
        return new Response(
          JSON.stringify({ 
            ok: false, 
            code: 'author_mismatch', 
            message: `This ${platform} post is from @${platformUserId} but you're connected as @${connectedHandle}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      verificationMethod = 'connected_account';
    } else if (!connectedHandle && platformUserId) {
      // Has username in URL but no connected account
      verificationMethod = 'url_match';
    } else {
      // No way to verify ownership - mark for review
      requiresReview = true;
      verificationMethod = 'manual';
    }

    // Validate campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from('sharing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      return new Response(
        JSON.stringify({ ok: false, code: 'campaign_not_found', message: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!campaign.is_active) {
      console.error('Campaign inactive');
      return new Response(
        JSON.stringify({ ok: false, code: 'campaign_inactive', message: 'Campaign is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const remainingBudget = campaign.total_budget - campaign.spent_budget;
    if (remainingBudget < campaign.reward_per_share) {
      console.error('Insufficient budget:', { remainingBudget, rewardPerShare: campaign.reward_per_share });
      return new Response(
        JSON.stringify({ ok: false, code: 'budget_exhausted', message: 'Campaign has run out of budget' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user share limit
    if (campaign.max_shares_per_user) {
      const { count, error: countError } = await supabase
        .from('user_shares')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id);

      if (countError) {
        console.error('Share count error:', countError);
      } else if (count !== null && count >= campaign.max_shares_per_user) {
        console.error('Share limit reached:', { count, limit: campaign.max_shares_per_user });
        return new Response(
          JSON.stringify({ ok: false, code: 'limit_reached', message: 'You have reached the share limit for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for duplicate by platform user ID
    if (platformUserId) {
      const { data: existingByUser } = await supabase
        .from('user_shares')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('share_platform', platform)
        .eq('platform_user_id', platformUserId)
        .limit(1)
        .maybeSingle();

      if (existingByUser) {
        console.error('Already shared by user');
        return new Response(
          JSON.stringify({ ok: false, code: 'already_shared', message: 'You have already verified a share for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for duplicate by post ID
    if (postId) {
      const { data: existingByPost } = await supabase
        .from('user_shares')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('share_platform', platform)
        .eq('post_id', postId)
        .limit(1)
        .maybeSingle();

      if (existingByPost) {
        console.error('Post already used');
        return new Response(
          JSON.stringify({ ok: false, code: 'post_used', message: 'This post has already been used for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Determine final status
    const status = requiresReview ? 'pending_review' : 'verified';
    const verifiedAt = requiresReview ? null : new Date().toISOString();

    // Insert the share
    const { data: share, error: insertError } = await supabase
      .from('user_shares')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        share_url: shareUrl.trim(),
        share_platform: platform,
        platform_user_id: platformUserId,
        post_id: postId,
        reward_amount: campaign.reward_per_share,
        status,
        verified_at: verifiedAt,
        verification_method: verificationMethod,
        requires_review: requiresReview,
        twitter_handle: platform === 'twitter' ? platformUserId : null, // Backward compat
        tweet_id: platform === 'twitter' ? postId : null, // Backward compat
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Map database errors to user-friendly codes
      if (insertError.code === '23505') { // unique_violation
        if (insertError.message.includes('idx_user_shares_campaign_twitter')) {
          return new Response(
            JSON.stringify({ ok: false, code: 'already_shared', message: 'You have already verified a share for this campaign' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (insertError.message.includes('idx_user_shares_campaign_tweet')) {
          return new Response(
            JSON.stringify({ ok: false, code: 'tweet_used', message: 'This tweet has already been used for this campaign' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (insertError.message?.includes('insufficient budget')) {
        return new Response(
          JSON.stringify({ ok: false, code: 'budget_exhausted', message: 'Campaign has run out of budget' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (insertError.message?.includes('maximum shares')) {
        return new Response(
          JSON.stringify({ ok: false, code: 'limit_reached', message: 'You have reached the share limit for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (insertError.code === '42501') { // RLS policy violation
        return new Response(
          JSON.stringify({ ok: false, code: 'auth_error', message: 'Authentication error. Please sign in again.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Unknown error
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'unknown', 
          message: insertError.message || 'Failed to verify share',
          details: insertError 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Share verified successfully:', share.id);

    return new Response(
      JSON.stringify({ ok: true, data: share }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ 
        ok: false, 
        code: 'unknown', 
        message: errorMessage,
        details: error 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
