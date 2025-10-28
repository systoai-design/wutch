import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import bs58 from 'https://esm.sh/bs58@5.0.0';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to generate random nonce
function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const rateLimit = await checkRateLimit('verify-wallet', user.id, ipAddress);
    
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const { walletAddress, signature, message } = await req.json();

    if (!walletAddress || !signature || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse message to extract timestamp and nonce
    const messageMatch = message.match(/Sign this message to verify your wallet: (\d+):(\w+)/);
    if (!messageMatch) {
      console.error('Invalid message format received:', {
        message,
        messageLength: message.length,
        messageBytes: Array.from(new TextEncoder().encode(message)),
        expectedPattern: 'Sign this message to verify your wallet: {timestamp}:{nonce}',
        receivedLines: message.split('\n').length
      });
      return new Response(
        JSON.stringify({ error: 'Invalid message format. Please ensure your wallet is unlocked and try again.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const timestamp = parseInt(messageMatch[1]);
    const nonce = messageMatch[2];

    // Verify timestamp is within 5 minutes
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - timestamp > fiveMinutes) {
      return new Response(
        JSON.stringify({ error: 'Signature expired. Please try again.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create admin client for checking nonces
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if signature has already been used (replay attack protection)
    const { data: existingNonce } = await supabaseAdmin
      .from('signature_nonces')
      .select('id')
      .eq('signature', signature)
      .maybeSingle();

    if (existingNonce) {
      return new Response(
        JSON.stringify({ error: 'Signature already used. Please generate a new signature.' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify signature with Solana's ed25519
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);

    try {
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      if (!verified) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature - wallet ownership could not be verified' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (verifyError) {
      console.error('Signature verification failed:', verifyError);
      console.error('Signature details:', { signature, walletAddress, messageLength: message.length });
      return new Response(
        JSON.stringify({ error: 'Failed to verify signature. Please ensure your wallet is unlocked and try again.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Store signature nonce to prevent replay attacks
    await supabaseAdmin
      .from('signature_nonces')
      .insert({
        signature,
        wallet_address: walletAddress,
        used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry
      });

    // Check if wallet is already linked to another account
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('profile_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing wallet:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify wallet availability' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (existing && existing.user_id !== user.id) {
      return new Response(
        JSON.stringify({ 
          error: 'This wallet is already connected to another account. Each wallet can only be linked to one account.' 
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Save verified wallet
    // Try to insert first
    const { error: insertError } = await supabaseAdmin
      .from('profile_wallets')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
      });

    // If conflict (user already has a wallet), update instead
    if (insertError?.code === '23505') {
      const { error: updateError } = await supabaseAdmin
        .from('profile_wallets')
        .update({ 
          wallet_address: walletAddress,
          last_connected_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
        
      if (updateError) {
        console.error('Error updating wallet:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update wallet' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (insertError) {
      console.error('Error inserting wallet:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to save wallet: ${insertError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Also update public_wallet_address in profiles for donations
    await supabaseAdmin
      .from('profiles')
      .update({ public_wallet_address: walletAddress })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in verify-wallet function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
