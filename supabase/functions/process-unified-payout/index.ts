import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "npm:@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security validation
async function validatePayoutSecurity(
  userId: string,
  amount: number,
  supabaseAdmin: any
): Promise<void> {
  // Check circuit breaker
  const { data: payoutsEnabled } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'payouts_enabled')
    .maybeSingle();

  if (payoutsEnabled?.setting_value === false) {
    throw new Error('Payouts temporarily disabled for maintenance');
  }

  // Check limits
  const { data: maxPerTx } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'max_payout_per_transaction')
    .maybeSingle();

  const { data: maxPerHour } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'max_payout_per_hour_per_user')
    .maybeSingle();

  const maxPerTransaction = maxPerTx?.setting_value || 5;
  const maxPerHourPerUser = maxPerHour?.setting_value || 10;

  if (amount > maxPerTransaction) {
    throw new Error(`Amount exceeds maximum (${maxPerTransaction} SOL per transaction)`);
  }

  // Check hourly limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPayouts } = await supabaseAdmin
    .from('platform_transactions')
    .select('creator_amount')
    .eq('seller_id', userId)
    .in('transaction_type', ['share_reward', 'bounty_reward'])
    .eq('status', 'confirmed')
    .gte('created_at', oneHourAgo);

  const hourlyTotal = recentPayouts?.reduce((sum: number, tx: any) => sum + Number(tx.creator_amount), 0) || 0;

  if (hourlyTotal + amount > maxPerHourPerUser) {
    throw new Error(`Hourly limit exceeded (${maxPerHourPerUser} SOL/hour). Used ${hourlyTotal.toFixed(4)} SOL in last hour.`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    requestBody = await req.json();
    const { payoutType, userId, walletAddress, campaignId, bountyId } = requestBody;

    // Security: verify requesting user matches userId
    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Cannot claim rewards for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || !walletAddress || !payoutType) {
      throw new Error('Missing required parameters');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let totalAmount = 0;
    let claimableItems: any[] = [];
    let transactionType: string;
    let metadata: any = {};

    // Get claimable items based on payout type
    if (payoutType === 'share_reward') {
      if (!campaignId) throw new Error('Campaign ID required for share rewards');
      
      const { data: shares, error: sharesError } = await supabaseAdmin
        .from('user_shares')
        .select('*')
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .eq('is_claimed', false)
        .eq('status', 'verified');

      if (sharesError) throw sharesError;
      if (!shares || shares.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No unclaimed shares found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      claimableItems = shares;
      totalAmount = shares.reduce((sum, s) => sum + Number(s.reward_amount), 0);
      transactionType = 'share_reward';
      metadata = { campaign_id: campaignId, shares_count: shares.length };

    } else if (payoutType === 'bounty_reward') {
      if (!bountyId) throw new Error('Bounty ID required for bounty rewards');
      
      const { data: bounty, error: bountyError } = await supabaseAdmin
        .from('stream_bounties')
        .select('*')
        .eq('id', bountyId)
        .eq('is_active', true)
        .single();

      if (bountyError || !bounty) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bounty not found or inactive' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already claimed
      const { data: existingClaim } = await supabaseAdmin
        .from('bounty_claims')
        .select('*')
        .eq('bounty_id', bountyId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingClaim) {
        return new Response(
          JSON.stringify({ success: false, error: 'Already claimed this bounty' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      totalAmount = bounty.reward_per_participant;
      transactionType = 'bounty_reward';
      metadata = { bounty_id: bountyId };

    } else {
      throw new Error('Invalid payout type');
    }

    // Validate security
    await validatePayoutSecurity(userId, totalAmount, supabaseAdmin);

    // Connect to Solana
    const heliusApiKey = Deno.env.get('HELIUS_API_KEY');
    const rpcUrl = heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    
    const connection = new Connection(rpcUrl, "confirmed");

    // Load escrow wallet
    const escrowPrivateKey = Deno.env.get('ESCROW_WALLET_PRIVATE_KEY');
    if (!escrowPrivateKey) {
      throw new Error('Escrow wallet not configured');
    }

    const escrowWallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(escrowPrivateKey))
    );

    const recipientPubkey = new PublicKey(walletAddress);
    const lamports = Math.floor(totalAmount * LAMPORTS_PER_SOL);

    // Check balance
    const escrowBalance = await connection.getBalance(escrowWallet.publicKey);
    if (escrowBalance < lamports) {
      throw new Error(`Insufficient escrow funds. Need ${totalAmount} SOL, have ${(escrowBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrowWallet.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowWallet.publicKey;

    // Log as pending in platform_transactions
    const { data: platformTx, error: txLogError } = await supabaseAdmin
      .from('platform_transactions')
      .insert({
        transaction_type: transactionType,
        seller_id: userId,
        gross_amount: totalAmount,
        creator_amount: totalAmount,
        platform_amount: 0,
        seller_wallet: walletAddress,
        status: 'pending',
        metadata,
        ...(campaignId && { campaign_id: campaignId }),
        ...(bountyId && { bounty_id: bountyId })
      })
      .select()
      .single();

    if (txLogError) {
      console.error('Error logging transaction:', txLogError);
    }

    // Sign and send
    transaction.sign(escrowWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    // Update platform transaction
    if (platformTx) {
      await supabaseAdmin
        .from('platform_transactions')
        .update({
          status: 'confirmed',
          transaction_signature: signature,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', platformTx.id);
    }

    // Update claim records
    if (payoutType === 'share_reward') {
      const shareIds = claimableItems.map(s => s.id);
      await supabaseAdmin
        .from('user_shares')
        .update({
          is_claimed: true,
          status: 'paid',
          paid_at: new Date().toISOString(),
          transaction_signature: signature,
        })
        .in('id', shareIds);

      // Log in legacy table
      await supabaseAdmin.from('escrow_transactions').insert({
        transaction_type: 'payout_share',
        amount: totalAmount,
        from_wallet: escrowWallet.publicKey.toString(),
        to_wallet: walletAddress,
        transaction_signature: signature,
        user_id: userId,
        campaign_id: campaignId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      });

    } else if (payoutType === 'bounty_reward') {
      await supabaseAdmin
        .from('bounty_claims')
        .insert({
          bounty_id: bountyId,
          user_id: userId,
          wallet_address: walletAddress,
          is_correct: true,
          reward_amount: totalAmount,
          transaction_signature: signature,
        });

      // Update bounty claimed count
      await supabaseAdmin.rpc('increment', {
        row_id: bountyId,
        table_name: 'stream_bounties',
        column_name: 'claimed_count'
      });

      // Log in legacy table
      await supabaseAdmin.from('escrow_transactions').insert({
        transaction_type: 'payout_bounty',
        amount: totalAmount,
        from_wallet: escrowWallet.publicKey.toString(),
        to_wallet: walletAddress,
        transaction_signature: signature,
        user_id: userId,
        bounty_id: bountyId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      });
    }

    console.log(`[UnifiedPayout] Success: ${totalAmount} SOL paid to ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalPaid: totalAmount,
        itemsClaimed: claimableItems.length,
        transactionSignature: signature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[UnifiedPayout] Error:', error);
    console.error('[UnifiedPayout] Error stack:', error.stack);
    console.error('[UnifiedPayout] Error details:', {
      message: error.message,
      payoutType: requestBody?.payoutType,
      userId: requestBody?.userId,
      campaignId: requestBody?.campaignId,
      bountyId: requestBody?.bountyId,
      walletAddress: requestBody?.walletAddress
    });

    // Log failed transaction
    try {
      if (requestBody?.userId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin
          .from('platform_transactions')
          .insert({
            transaction_type: requestBody.payoutType || 'share_reward',
            seller_id: requestBody.userId,
            gross_amount: 0,
            creator_amount: 0,
            platform_amount: 0,
            seller_wallet: requestBody.walletAddress,
            status: 'failed',
            error_message: error.message,
          });
      }
    } catch (logError) {
      console.error('Error logging failed transaction:', logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
