import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { decode as decodeBase58 } from 'https://deno.land/std@0.205.0/encoding/base58.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  walletAddress: string;
  signature: string;
  message: string;
  username: string;
  displayName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, signature, message, username, displayName }: RegisterRequest = await req.json();

    console.log('Registration attempt for wallet:', walletAddress);

    // Validate inputs
    if (!walletAddress || !signature || !message || !username) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return new Response(
        JSON.stringify({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Check if wallet is already registered
    const { data: existingWallet } = await supabaseAdmin
      .from('profile_wallets')
      .select('user_id')
      .eq('wallet_address', walletAddress)
      .single();

    if (existingWallet) {
      return new Response(
        JSON.stringify({ error: 'This wallet is already registered. Please use login instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if username is already taken
    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ error: 'Username is already taken' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Create anonymous auth user with wallet metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email_confirm: true,
      user_metadata: {
        wallet_address: walletAddress,
        username: username,
        display_name: displayName || username,
        wallet_only: true,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        username: username,
        display_name: displayName || username,
        public_wallet_address: walletAddress,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create profile_wallets entry
    const { error: walletError } = await supabaseAdmin
      .from('profile_wallets')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        first_connected_at: new Date().toISOString(),
        last_connected_at: new Date().toISOString(),
        connection_count: 1,
      });

    if (walletError) {
      console.error('Wallet linking error:', walletError);
      // Clean up profile and auth user
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to link wallet to profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate session token for the new user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${userId}@wallet.wutch.app`, // Placeholder email for wallet-only accounts
      options: {
        redirectTo: `${req.headers.get('origin') || '/'}/`,
      },
    });

    if (sessionError) {
      console.error('Session generation error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'User created but failed to generate session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Registration successful for wallet:', walletAddress);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          username: username,
          walletAddress: walletAddress,
        },
        session: sessionData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
