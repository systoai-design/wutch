import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "npm:@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security function: Validate payout security limits
async function validatePayoutSecurity(
  userId: string,
  amount: number,
  supabaseAdmin: any
): Promise<void> {
  // Check if payouts are enabled (circuit breaker)
  const { data: payoutsEnabled } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'payouts_enabled')
    .single();

  if (payoutsEnabled?.setting_value === false) {
    throw new Error('Payouts are temporarily disabled for maintenance');
  }

  // Get max limits from settings
  const { data: maxPerTx } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'max_payout_per_transaction')
    .single();

  const { data: maxPerHour } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'max_payout_per_hour_per_user')
    .single();

  const maxPerTransaction = maxPerTx?.setting_value || 5;
  const maxPerHourPerUser = maxPerHour?.setting_value || 10;

  // Check single transaction limit
  if (amount > maxPerTransaction) {
    throw new Error(`Transaction amount exceeds maximum allowed (${maxPerTransaction} SOL)`);
  }

  // Check hourly limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPayouts } = await supabaseAdmin
    .from('escrow_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('transaction_type', 'payout_share')
    .eq('status', 'confirmed')
    .gte('created_at', oneHourAgo);

  const hourlyTotal = recentPayouts?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;

  if (hourlyTotal + amount > maxPerHourPerUser) {
    throw new Error(`Hourly withdrawal limit exceeded (${maxPerHourPerUser} SOL/hour). You've used ${hourlyTotal.toFixed(4)} SOL in the last hour. Please try again later.`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, campaignId, walletAddress } = await req.json();

    // SECURITY: Verify the requesting user matches the userId
    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Cannot claim rewards for another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || !campaignId || !walletAddress) {
      throw new Error('Missing required parameters');
    }

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all unclaimed shares for this user and campaign
    const { data: unclaimedShares, error: sharesError } = await supabaseAdmin
      .from('user_shares')
      .select('*')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .eq('is_claimed', false)
      .eq('status', 'verified');

    if (sharesError) throw sharesError;

    if (!unclaimedShares || unclaimedShares.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No unclaimed shares found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate total amount to pay
    const totalAmount = unclaimedShares.reduce((sum, share) => sum + Number(share.reward_amount), 0);

    // Validate payout security (rate limiting, circuit breaker)
    await validatePayoutSecurity(userId, totalAmount, supabaseAdmin);

    // Connect to Solana using secure RPC endpoint
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");

    // Load escrow wallet from private key
    const escrowPrivateKey = Deno.env.get('ESCROW_WALLET_PRIVATE_KEY');
    if (!escrowPrivateKey) {
      throw new Error('Escrow wallet private key not configured');
    }

    const escrowWallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(escrowPrivateKey))
    );

    // Create recipient public key
    const recipientPubkey = new PublicKey(walletAddress);

    // Convert SOL to lamports
    const lamports = Math.floor(totalAmount * LAMPORTS_PER_SOL);

    // Check escrow wallet balance before attempting transfer
    const escrowBalance = await connection.getBalance(escrowWallet.publicKey);

    if (escrowBalance < lamports) {
      throw new Error(
        `Insufficient funds in escrow wallet. Need ${totalAmount} SOL but only have ${(escrowBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      );
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrowWallet.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = escrowWallet.publicKey;

    // Log transaction as pending
    const { data: txLog, error: txLogError } = await supabaseAdmin
      .from('escrow_transactions')
      .insert({
        transaction_type: 'payout_share',
        amount: totalAmount,
        from_wallet: escrowWallet.publicKey.toString(),
        to_wallet: walletAddress,
        user_id: userId,
        campaign_id: campaignId,
        status: 'pending'
      })
      .select()
      .single();

    if (txLogError) {
      console.error('Error logging transaction:', txLogError);
    }

    // Sign and send transaction
    transaction.sign(escrowWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Update transaction log
    if (txLog) {
      await supabaseAdmin
        .from('escrow_transactions')
        .update({
          status: 'confirmed',
          transaction_signature: signature,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', txLog.id);
    }

    // Mark all shares as claimed
    const shareIds = unclaimedShares.map(share => share.id);
    const { error: updateError } = await supabaseAdmin
      .from('user_shares')
      .update({
        is_claimed: true,
        status: 'claimed',
        paid_at: new Date().toISOString(),
        transaction_signature: signature,
      })
      .in('id', shareIds);

    if (updateError) {
      console.error('Error updating shares:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalPaid: totalAmount,
        sharesClaimed: unclaimedShares.length,
        transactionSignature: signature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-share-payout:', error);

    // Log failed transaction if we have the details
    try {
      const { userId, campaignId, walletAddress } = await req.json();
      if (userId && campaignId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseAdmin
          .from('escrow_transactions')
          .insert({
            transaction_type: 'payout_share',
            amount: 0,
            to_wallet: walletAddress,
            user_id: userId,
            campaign_id: campaignId,
            status: 'failed',
            error_message: error.message
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
