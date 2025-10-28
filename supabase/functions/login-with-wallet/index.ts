import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { decode as decodeBase58 } from 'https://deno.land/std@0.205.0/encoding/base58.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoginRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, signature, message }: LoginRequest = await req.json();

    console.log('Login attempt for wallet:', walletAddress);

    // Validate inputs
    if (!walletAddress || !signature || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Look up user by wallet address
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('profile_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ error: 'Wallet not registered. Please sign up first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify message format and timestamp
    const messagePattern = /^Sign this message to authenticate with Wutch:\n(\d+)\n([a-f0-9-]+)$/;
    const match = message.match(messagePattern);
    
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = parseInt(match[1]);
    const nonce = match[2];
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - timestamp > fiveMinutes) {
      return new Response(
        JSON.stringify({ error: 'Message expired. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if nonce has been used
    const { data: existingNonce } = await supabaseAdmin
      .from('signature_nonces')
      .select('nonce')
      .eq('nonce', nonce)
      .single();

    if (existingNonce) {
      return new Response(
        JSON.stringify({ error: 'Signature has already been used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify wallet signature
    try {
      if (!nacl?.sign?.detached?.verify) {
        throw new Error('Signature verification not available');
      }

      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = decodeBase58(signature);
      const publicKeyBytes = decodeBase58(walletAddress);

      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      if (!verified) {
        return new Response(
          JSON.stringify({ error: 'Invalid wallet signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to verify wallet signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store nonce to prevent replay attacks
    await supabaseAdmin
      .from('signature_nonces')
      .insert({
        nonce,
        wallet_address: walletAddress,
        expires_at: new Date(timestamp + fiveMinutes).toISOString(),
      });

    // Update last connected timestamp
    await supabaseAdmin
      .from('profile_wallets')
      .update({
        last_connected_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress);

    // Generate session for the user using deterministic email
    const pseudoEmail = `${walletAddress}@wallet.wutch.app`;
    const { data: linkData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: pseudoEmail,
    });

    if (sessionError || !linkData) {
      console.error('Session generation error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create login session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login successful for wallet:', walletAddress);

    return new Response(
      JSON.stringify({
        success: true,
        session: linkData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
