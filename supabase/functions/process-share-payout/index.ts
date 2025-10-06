import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "npm:@solana/web3.js@1.98.4";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, campaignId, walletAddress } = await req.json();

    if (!userId || !campaignId || !walletAddress) {
      throw new Error('Missing required parameters');
    }

    console.log('Processing share payout for:', { userId, campaignId, walletAddress });

    // Get all unclaimed shares for this user and campaign
    const { data: unclaimedShares, error: sharesError } = await supabaseClient
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
    console.log(`Total to pay: ${totalAmount} SOL`);

    // Connect to Solana devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

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

    console.log(`Sending ${lamports} lamports to ${walletAddress}`);

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

    // Sign and send transaction
    transaction.sign(escrowWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    console.log('Transaction sent:', signature);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Transaction confirmed:', signature);

    // Mark all shares as claimed
    const shareIds = unclaimedShares.map(share => share.id);
    const { error: updateError } = await supabaseClient
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
