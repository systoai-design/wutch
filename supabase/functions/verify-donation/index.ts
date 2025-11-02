import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.87.6";
import { validateInput, donationValidationSchema } from "../_shared/validation.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    
    // Validate input using Zod schema
    const validatedData = validateInput(donationValidationSchema, requestBody);
    
    const {
      transactionSignature,
      donorWallet,
      recipientUserId,
      contentId,
      contentType,
      amount,
      message
    } = validatedData;

    // SECURITY: Verify that the authenticated user owns the donor wallet
    const { data: userWallet, error: walletError } = await supabaseClient
      .from('profile_wallets')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (walletError || !userWallet) {
      return new Response(
        JSON.stringify({ error: 'User wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userWallet.wallet_address !== donorWallet) {
      return new Response(
        JSON.stringify({ error: 'Donor wallet must match authenticated user wallet' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const rateLimit = await checkRateLimit('verify-donation', user.id, ipAddress);
    
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    // Connect to Solana mainnet using environment variable
    const solanaRpcUrl = Deno.env.get('SOLANA_RPC_URL');
    if (!solanaRpcUrl) {
      throw new Error('Solana RPC URL not configured');
    }
    
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    
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
        JSON.stringify({ error: 'Failed to record donation' }),
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
    } else if (contentType === 'wutch_video') {
      await supabaseClient
        .from('wutch_videos')
        .update({ total_donations: amount })
        .eq('id', contentId);
    }

    // Update profile total donations (creator gets 95%)
    await supabaseClient.rpc('increment_user_donations', {
      user_id: recipientUserId,
      donation_amount: creatorAmount
    });

    return new Response(
      JSON.stringify({ success: true, donation }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in verify-donation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
