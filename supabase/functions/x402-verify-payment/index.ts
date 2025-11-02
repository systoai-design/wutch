import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.87.6";
import { validateInput, x402PaymentValidationSchema } from "../_shared/validation.ts";

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

    const requestBody = await req.json();
    
    // Validate input using Zod schema
    const validatedData = validateInput(x402PaymentValidationSchema, requestBody);
    const { transactionSignature, contentType, contentId } = validatedData;

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

    // Connect to Solana mainnet - MUST have RPC URL configured
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL');
    if (!SOLANA_RPC_URL) {
      console.error('SOLANA_RPC_URL not configured');
      throw new Error('Payment verification temporarily unavailable');
    }
    
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Get transaction details
    console.log('[X402Verify] Fetching transaction:', transactionSignature);
    const transaction = await connection.getParsedTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized'
    });

    if (!transaction) {
      const errorId = crypto.randomUUID();
      console.error(`[${errorId}] Transaction not found:`, transactionSignature);
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found. Please wait a few moments and try again.',
          errorId
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction is confirmed
    if (transaction.meta?.err) {
      const errorId = crypto.randomUUID();
      console.error(`[${errorId}] Transaction failed on-chain:`, {
        signature: transactionSignature,
        error: transaction.meta.err,
        logs: transaction.meta.logMessages
      });
      return new Response(
        JSON.stringify({ 
          error: 'Transaction failed on blockchain',
          errorId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[X402Verify] Transaction confirmed successfully');

    // Extract transaction details
    const instructions = transaction.transaction.message.instructions;
    let creatorRecipient = '';
    let platformRecipient = '';
    let creatorAmount = 0;
    let platformAmount = 0;

    // Parse transfer instructions - should have 2 transfers (95% to creator, 5% to platform)
    let transferCount = 0;
    let creatorAmountLamports = 0;
    let platformAmountLamports = 0;
    
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
        const info = instruction.parsed.info;
        
        if (info.destination === creatorWallet.wallet_address) {
          creatorRecipient = info.destination;
          creatorAmountLamports = info.lamports;
          creatorAmount = info.lamports / LAMPORTS_PER_SOL;
          transferCount++;
        } else if (info.destination === PLATFORM_WALLET) {
          platformRecipient = info.destination;
          platformAmountLamports = info.lamports;
          platformAmount = info.lamports / LAMPORTS_PER_SOL;
          transferCount++;
        }
      }
    }

    if (transferCount !== 2) {
      const errorId = crypto.randomUUID();
      console.error(`[${errorId}] Invalid transaction structure:`, {
        expected: 2,
        actual: transferCount,
        signature: transactionSignature
      });
      throw new Error('Invalid payment structure');
    }

    console.log('[X402Verify] Transaction structure valid: 2 transfers found');

    // Verify amounts using integer lamports math (95% to creator, 5% to platform)
    const priceLamports = Math.round(price * LAMPORTS_PER_SOL);
    const expectedCreatorLamports = Math.floor(priceLamports * 95 / 100);
    const expectedPlatformLamports = priceLamports - expectedCreatorLamports;

    const errorId = crypto.randomUUID();
    console.log(`[${errorId}] Amount verification:`, {
      priceLamports,
      expectedCreatorLamports,
      actualCreatorLamports: creatorAmountLamports,
      expectedPlatformLamports,
      actualPlatformLamports: platformAmountLamports,
    });

    if (creatorAmountLamports !== expectedCreatorLamports) {
      console.error(`[${errorId}] Invalid creator amount`, {
        expected: expectedCreatorLamports,
        actual: creatorAmountLamports
      });
      throw new Error('Invalid payment amount');
    }

    if (platformAmountLamports !== expectedPlatformLamports) {
      console.error(`[${errorId}] Invalid platform amount`, {
        expected: expectedPlatformLamports,
        actual: platformAmountLamports
      });
      throw new Error('Invalid payment amount');
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
