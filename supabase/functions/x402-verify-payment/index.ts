import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.87.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_WALLET = "899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G";

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

    // Service role client to bypass RLS for wallet lookup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { transactionSignature, contentType, contentId } = await req.json();

    if (!transactionSignature || !contentType || !contentId) {
      throw new Error('Missing required fields: transactionSignature, contentType, contentId');
    }

    console.log('Verifying x402 payment:', { transactionSignature, contentType, contentId, userId: user.id });

    // Get content details and price
    let contentData: any;
    let creatorId: string;
    let price: number;
    let postType: string | null = null;
    
    const tableName = contentType === 'livestream' ? 'livestreams' 
                    : contentType === 'shortvideo' ? 'short_videos'
                    : contentType === 'community_post' ? 'community_posts'
                    : 'wutch_videos';

    const { data: content, error: contentError } = await supabaseClient
      .from(tableName)
      .select('*')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error('Content not found');
    }

    if (!content.is_premium || !content.x402_price) {
      throw new Error('Content is not premium or has no price set');
    }

    creatorId = content.user_id;
    price = content.x402_price;
    if (contentType === 'community_post') {
      postType = content.post_type;
    }

    console.log('Content details:', { creatorId, price, isPremium: content.is_premium, postType });

    // Get creator's wallet address (using admin client to bypass RLS)
    const { data: creatorWallet, error: walletError } = await supabaseAdmin
      .from('profile_wallets')
      .select('wallet_address')
      .eq('user_id', creatorId)
      .maybeSingle();

    if (walletError || !creatorWallet) {
      console.error('Wallet lookup error:', walletError);
      throw new Error('Creator wallet not found');
    }

    // Connect to Solana mainnet
    const connection = new Connection(
      Deno.env.get('SOLANA_RPC_URL') || 'https://mainnet.helius-rpc.com/?api-key=a181d89a-54f8-4a83-a857-a760d595180f',
      'confirmed'
    );

    // Get transaction details
    const transaction = await connection.getParsedTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Verify transaction is confirmed
    if (transaction.meta?.err) {
      throw new Error('Transaction failed');
    }

    // Extract transaction details
    const instructions = transaction.transaction.message.instructions;
    let creatorRecipient = '';
    let platformRecipient = '';
    let creatorAmount = 0;
    let platformAmount = 0;

    // Parse transfer instructions - should have 2 transfers (95% to creator, 5% to platform)
    let transferCount = 0;
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
        const info = instruction.parsed.info;
        const amount = info.lamports / LAMPORTS_PER_SOL;
        
        if (info.destination === creatorWallet.wallet_address) {
          creatorRecipient = info.destination;
          creatorAmount = amount;
          transferCount++;
        } else if (info.destination === PLATFORM_WALLET) {
          platformRecipient = info.destination;
          platformAmount = amount;
          transferCount++;
        }
      }
    }

    if (transferCount !== 2) {
      throw new Error('Invalid transaction structure. Expected 2 transfers (creator + platform)');
    }

    // Verify amounts (95% to creator, 5% to platform)
    const expectedCreatorAmount = price * 0.95;
    const expectedPlatformAmount = price * 0.05;

    if (Math.abs(creatorAmount - expectedCreatorAmount) > 0.0001) {
      throw new Error(`Invalid creator amount. Expected ${expectedCreatorAmount} SOL, got ${creatorAmount} SOL`);
    }

    if (Math.abs(platformAmount - expectedPlatformAmount) > 0.0001) {
      throw new Error(`Invalid platform amount. Expected ${expectedPlatformAmount} SOL, got ${platformAmount} SOL`);
    }

    // Check if transaction already used
    if (contentType === 'community_post') {
      const { data: existingPurchase } = await supabaseClient
        .from('community_post_purchases')
        .select('id')
        .eq('transaction_signature', transactionSignature)
        .maybeSingle();

      if (existingPurchase) {
        throw new Error('Transaction already used for community post purchase');
      }
    } else {
      const { data: existingPurchase } = await supabaseClient
        .from('x402_purchases')
        .select('id')
        .eq('transaction_signature', transactionSignature)
        .maybeSingle();

      if (existingPurchase) {
        throw new Error('Transaction already used for x402 purchase');
      }
    }

    // Record the purchase
    let purchase: any;
    let purchaseError: any;

    if (contentType === 'community_post') {
      const result = await supabaseClient
        .from('community_post_purchases')
        .insert({
          user_id: user.id,
          post_id: contentId,
          amount: price,
          asset: 'SOL',
          network: 'solana',
          payment_proof: JSON.stringify({
            creatorAmount,
            platformAmount,
            creatorRecipient,
            platformRecipient,
          }),
          transaction_signature: transactionSignature,
          is_active: true,
          expires_at: null,
        })
        .select()
        .single();
      
      purchase = result.data;
      purchaseError = result.error;

      // If this is a service post, create a service order
      if (!purchaseError && postType === 'service') {
        const { error: orderError } = await supabaseClient
          .from('service_orders')
          .insert({
            purchase_id: purchase.id,
            post_id: contentId,
            buyer_id: user.id,
            seller_id: creatorId,
            status: 'pending',
          });

        if (orderError) {
          console.error('Error creating service order:', orderError);
        }
      }
    } else {
      const result = await supabaseClient
        .from('x402_purchases')
        .insert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          amount: price,
          asset: 'SOL',
          network: 'solana',
          payment_proof: JSON.stringify({
            creatorAmount,
            platformAmount,
            creatorRecipient,
            platformRecipient,
          }),
          transaction_signature: transactionSignature,
          is_active: true,
          expires_at: null,
        })
        .select()
        .single();
      
      purchase = result.data;
      purchaseError = result.error;
    }

    if (purchaseError) {
      console.error('Error recording purchase:', purchaseError);
      throw new Error('Failed to record purchase');
    }

    // Record platform fee
    await supabaseClient.rpc('record_x402_fee', {
      p_amount: platformAmount,
      p_content_id: contentId,
      p_content_type: `x402_${contentType}`,
    });

    console.log('x402 payment verified successfully:', { purchaseId: purchase.id });

    return new Response(
      JSON.stringify({
        success: true,
        purchase: {
          id: purchase.id,
          contentType,
          contentId,
          amount: price,
          creatorAmount,
          platformAmount,
        },
        transactionSignature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying x402 payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
