import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.87.6";

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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subscriptionId, transactionSignature, fromWallet } = await req.json();

    if (!subscriptionId || !transactionSignature || !fromWallet) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch subscription tier details
    const { data: subscription, error: subError } = await supabaseClient
      .from('creator_subscriptions')
      .select(`
        *,
        profiles:creator_id (
          username,
          display_name,
          public_wallet_address
        )
      `)
      .eq('id', subscriptionId)
      .single();

    if (subError || !subscription) {
      console.error('Subscription fetch error:', subError);
      return new Response(
        JSON.stringify({ error: 'Subscription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscription.is_active) {
      return new Response(
        JSON.stringify({ error: 'Subscription tier is inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creatorWallet = subscription.profiles?.public_wallet_address;
    if (!creatorWallet) {
      return new Response(
        JSON.stringify({ error: 'Creator has not set up their wallet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Solana transaction
    const rpcUrl = Deno.env.get('HELIUS_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const txDetails = await connection.getParsedTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!txDetails || !txDetails.meta) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found or not confirmed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction is successful
    if (txDetails.meta.err) {
      return new Response(
        JSON.stringify({ error: 'Transaction failed on blockchain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the transfer instruction
    const transferInstruction = txDetails.transaction.message.instructions.find((ix: any) => {
      if ('parsed' in ix && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info;
        return (
          info.source === fromWallet &&
          info.destination === creatorWallet
        );
      }
      return false;
    });

    if (!transferInstruction || !('parsed' in transferInstruction)) {
      return new Response(
        JSON.stringify({ error: 'Valid transfer instruction not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transferAmount = transferInstruction.parsed.info.lamports / 1_000_000_000; // Convert to SOL
    const expectedAmount = Number(subscription.price_monthly);

    // Allow 1% tolerance for fees
    if (transferAmount < expectedAmount * 0.99) {
      return new Response(
        JSON.stringify({ 
          error: 'Payment amount insufficient',
          expected: expectedAmount,
          received: transferAmount 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create or update user subscription
    const { error: insertError } = await supabaseClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        subscription_id: subscriptionId,
        transaction_signature: transactionSignature,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        subscribed_at: new Date().toISOString(),
        last_payment_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,subscription_id',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('Subscription insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record platform fee (5%)
    const platformFee = expectedAmount * 0.05;
    const creatorAmount = expectedAmount * 0.95;

    // Log transaction in platform_transactions
    await supabaseClient
      .from('platform_transactions')
      .insert({
        buyer_id: user.id,
        seller_id: subscription.creator_id,
        transaction_type: 'subscription',
        gross_amount: expectedAmount,
        platform_amount: platformFee,
        creator_amount: creatorAmount,
        status: 'confirmed',
        transaction_signature: transactionSignature,
        confirmed_at: new Date().toISOString(),
        metadata: {
          subscription_id: subscriptionId,
          tier_name: subscription.tier_name,
          access_level: subscription.access_level,
          expires_at: expiresAt.toISOString()
        }
      });

    // Add to platform revenue pool
    await supabaseClient.rpc('add_to_revenue_pool', {
      p_amount: platformFee,
      p_fee_source: 'subscription',
      p_source_id: subscriptionId
    });

    console.log(`✅ Subscription verified: ${user.id} -> ${subscription.creator_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        expiresAt: expiresAt.toISOString(),
        tierName: subscription.tier_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Subscription verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
