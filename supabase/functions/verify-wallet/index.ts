import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import bs58 from 'https://esm.sh/bs58@5.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Verify signature with Solana's ed25519
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(walletAddress);

    // Import nacl for signature verification
    const nacl = await import('https://cdn.skypack.dev/tweetnacl@1.0.3?dts');
    
    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!verified) {
      console.log('Invalid signature verification');
      return new Response(
        JSON.stringify({ error: 'Invalid signature - wallet ownership could not be verified' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create admin client for checking existing wallets
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    console.log(`Attempting to save wallet for user: ${user.id}`);
    console.log(`Wallet address: ${walletAddress}`);
    
    // Try to insert first
    const { error: insertError } = await supabaseAdmin
      .from('profile_wallets')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
      });

    // If conflict (user already has a wallet), update instead
    if (insertError?.code === '23505') {
      console.log('Wallet exists for user, updating...');
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

    console.log(`Wallet ${walletAddress} verified and linked to user ${user.id}`);

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