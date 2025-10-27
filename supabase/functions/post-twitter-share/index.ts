import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decryptToken(encryptedToken: string): string {
  const key = Deno.env.get('TWITTER_ENCRYPTION_KEY') || 'default-key-change-in-production';
  const decoded = atob(encryptedToken);
  const decrypted = [];
  for (let i = 0; i < decoded.length; i++) {
    decrypted.push(String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
  }
  return decrypted.join('');
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac('sha1', signingKey);
  return hmacSha1.update(signatureBaseString).digest('base64');
}

function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    'OAuth ' +
    Object.entries(signedOAuthParams)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ')
  );
}

async function postTweet(
  tweetText: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<any> {
  const consumerKey = Deno.env.get('TWITTER_API_KEY')?.trim();
  const consumerSecret = Deno.env.get('TWITTER_API_SECRET')?.trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error('Twitter API credentials not configured');
  }

  const url = 'https://api.x.com/2/tweets';
  const method = 'POST';

  const oauthHeader = generateOAuthHeader(
    method,
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: oauthHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('Twitter API error:', responseText);
    throw new Error(`Failed to post tweet: ${responseText}`);
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
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

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contentId, contentType, contentTitle, contentUrl } = await req.json();

    if (!contentId || !contentType || !contentTitle || !contentUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Auto-posting tweet for user ${user.id}, content: ${contentId}`);

    // Get user's Twitter connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('twitter_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Twitter account not connected' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decrypt tokens
    const accessToken = decryptToken(connection.access_token_encrypted);
    const accessTokenSecret = decryptToken(connection.refresh_token_encrypted);

    // Generate tweet text based on content type
    const shareTexts = {
      livestream: `Watch "${contentTitle}" live on Wutch! 🔴`,
      short_video: `Check out "${contentTitle}" on Wutch! 🎬`,
      wutch_video: `Watch "${contentTitle}" on Wutch! 📺`,
    };

    const tweetText = `${shareTexts[contentType as keyof typeof shareTexts]} Earn crypto while watching! ${contentUrl} #Wutch #Web3 #Crypto`;

    // Post tweet
    const tweet = await postTweet(tweetText, accessToken, accessTokenSecret);

    console.log(`Tweet posted successfully: ${tweet.data.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        tweet: {
          id: tweet.data.id,
          text: tweet.data.text,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error posting tweet:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to post tweet' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
