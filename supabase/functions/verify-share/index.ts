import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyShareRequest {
  campaignId: string;
  tweetUrl: string;
  expectedHandle: string;
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

    const { campaignId, tweetUrl, expectedHandle }: VerifyShareRequest = await req.json();

    console.log('Verifying share:', { userId: user.id, campaignId, tweetUrl, expectedHandle });

    // Parse and sanitize the tweet URL
    const sanitizedUrl = tweetUrl.trim().replace(/[\u200E\u200F]/g, '').replace(/\/$/, '');
    
    // Extract tweet ID and username
    const standardMatch = sanitizedUrl.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/);
    const shortcutMatch = sanitizedUrl.match(/(?:twitter\.com|x\.com)\/i(?:\/web)?\/status\/(\d+)/);
    
    let tweetId: string | null = null;
    let username: string | null = null;

    if (standardMatch) {
      username = standardMatch[1];
      tweetId = standardMatch[2];
    } else if (shortcutMatch) {
      tweetId = shortcutMatch[1];
      // Use expectedHandle from frontend (derived from connected account)
      username = expectedHandle;
    }

    if (!tweetId || !username) {
      console.error('Invalid URL format:', sanitizedUrl);
      return new Response(
        JSON.stringify({ ok: false, code: 'invalid_url', message: 'Invalid Twitter/X URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed tweet:', { tweetId, username });

    // Get user's connected Twitter handle from profile
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

    const userTwitterHandle = profile.social_links?.twitter?.replace('@', '').toLowerCase();
    
    if (!userTwitterHandle) {
      console.error('No Twitter handle connected');
      return new Response(
        JSON.stringify({ ok: false, code: 'no_handle', message: 'No Twitter account connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify username matches connected account
    const normalizedUsername = username.toLowerCase();
    if (normalizedUsername !== userTwitterHandle) {
      console.error('Author mismatch:', { normalizedUsername, userTwitterHandle });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'author_mismatch', 
          message: `This tweet is from @${username} but you're connected as @${userTwitterHandle}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Check for duplicate by Twitter handle
    const { data: existingByHandle, error: handleCheckError } = await supabase
      .from('user_shares')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('twitter_handle', userTwitterHandle)
      .limit(1)
      .maybeSingle();

    if (handleCheckError) {
      console.error('Handle check error:', handleCheckError);
    } else if (existingByHandle) {
      console.error('Already shared by handle');
      return new Response(
        JSON.stringify({ ok: false, code: 'already_shared', message: 'You have already verified a share for this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate by tweet ID
    const { data: existingByTweet, error: tweetCheckError } = await supabase
      .from('user_shares')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('tweet_id', tweetId)
      .limit(1)
      .maybeSingle();

    if (tweetCheckError) {
      console.error('Tweet check error:', tweetCheckError);
    } else if (existingByTweet) {
      console.error('Tweet already used');
      return new Response(
        JSON.stringify({ ok: false, code: 'tweet_used', message: 'This tweet has already been used for this campaign' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the share
    const { data: share, error: insertError } = await supabase
      .from('user_shares')
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        share_url: sanitizedUrl,
        share_platform: 'twitter',
        reward_amount: campaign.reward_per_share,
        status: 'verified',
        verified_at: new Date().toISOString(),
        twitter_handle: userTwitterHandle,
        tweet_id: tweetId,
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
