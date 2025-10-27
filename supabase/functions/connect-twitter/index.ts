import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { createHmac } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwitterCredentials {
  accessToken: string;
  accessTokenSecret: string;
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

async function verifyTwitterCredentials(credentials: TwitterCredentials) {
  const consumerKey = Deno.env.get('TWITTER_API_KEY')?.trim();
  const consumerSecret = Deno.env.get('TWITTER_API_SECRET')?.trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error('Twitter API credentials not configured');
  }

  const url = 'https://api.x.com/2/users/me';
  const method = 'GET';

  const oauthHeader = generateOAuthHeader(
    method,
    url,
    consumerKey,
    consumerSecret,
    credentials.accessToken,
    credentials.accessTokenSecret
  );

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: oauthHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Twitter API error:', errorText);
    throw new Error('Failed to verify Twitter credentials');
  }

  const data = await response.json();
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
  };
}

// Simple encryption using XOR with environment key
function encryptToken(token: string): string {
  const key = Deno.env.get('TWITTER_ENCRYPTION_KEY') || 'default-key-change-in-production';
  const encrypted = [];
  for (let i = 0; i < token.length; i++) {
    encrypted.push(token.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(String.fromCharCode(...encrypted));
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

    const { accessToken, accessTokenSecret } = await req.json();

    if (!accessToken || !accessTokenSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing Twitter credentials' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Verifying Twitter credentials for user ${user.id}`);

    // Verify credentials with Twitter
    const twitterUser = await verifyTwitterCredentials({
      accessToken,
      accessTokenSecret,
    });

    console.log(`Twitter verification successful: @${twitterUser.username}`);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedAccessTokenSecret = encryptToken(accessTokenSecret);

    // Store or update Twitter connection
    const { error: upsertError } = await supabaseClient
      .from('twitter_connections')
      .upsert(
        {
          user_id: user.id,
          twitter_id: twitterUser.id,
          twitter_handle: twitterUser.username,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedAccessTokenSecret,
          is_active: true,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('Database error:', upsertError);
      throw upsertError;
    }

    console.log(`Twitter connection saved for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        twitter: {
          id: twitterUser.id,
          username: twitterUser.username,
          name: twitterUser.name,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error connecting Twitter:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to connect Twitter account' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
