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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { transactionSignature, donorWallet, recipientUserId, contentId, contentType, amount, message } = await req.json();

    console.log('Verifying donation:', { transactionSignature, donorWallet, recipientUserId, contentId, contentType, amount });

    // Connect to Solana mainnet (use devnet for testing)
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Verify transaction exists and is confirmed
    const transaction = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction is confirmed
    if (transaction.meta?.err) {
      return new Response(
        JSON.stringify({ error: 'Transaction failed on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient wallet address
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', recipientUserId)
      .single();

    if (!profile?.wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Recipient wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the transaction involves the correct wallets
    const recipientPubkey = new PublicKey(profile.wallet_address);
    const donorPubkey = new PublicKey(donorWallet);

    // Check transaction contains the correct accounts
    const accountKeys = transaction.transaction.message.staticAccountKeys || [];
    const hasRecipient = accountKeys.some((key: PublicKey) => key.equals(recipientPubkey));
    const hasDonor = accountKeys.some((key: PublicKey) => key.equals(donorPubkey));

    if (!hasRecipient || !hasDonor) {
      return new Response(
        JSON.stringify({ error: 'Transaction does not involve the specified wallets' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate platform fee (5%)
    const platformFee = amount * 0.05;
    const creatorAmount = amount * 0.95;

    // Record the donation
    const { data: donation, error: donationError } = await supabaseClient
      .from('donations')
      .insert({
        donor_wallet_address: donorWallet,
        recipient_user_id: recipientUserId,
        content_id: contentId,
        content_type: contentType,
        amount: amount,
        transaction_signature: transactionSignature,
        message: message,
        status: 'confirmed'
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error inserting donation:', donationError);
      return new Response(
        JSON.stringify({ error: donationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add platform fee to revenue pool
    await supabaseClient.rpc('add_to_revenue_pool', {
      p_amount: platformFee,
      p_fee_source: 'donation',
      p_source_id: donation.id
    });

    // Update total donations for the content
    if (contentType === 'livestream') {
      await supabaseClient
        .from('livestreams')
        .update({ total_donations: amount })
        .eq('id', contentId);
    } else if (contentType === 'shortvideo') {
      await supabaseClient
        .from('short_videos')
        .update({ total_donations: amount })
        .eq('id', contentId);
    }

    // Update profile total donations (creator gets 95%)
    await supabaseClient.rpc('increment_user_donations', {
      user_id: recipientUserId,
      donation_amount: creatorAmount
    });

    console.log('Donation verified and recorded:', donation);

    return new Response(
      JSON.stringify({ success: true, donation }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-donation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
