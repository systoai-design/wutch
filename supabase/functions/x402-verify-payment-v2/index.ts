import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.87.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_WALLET = "899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Rate limiting check
async function checkRateLimit(supabase: any, userId: string, ipAddress: string): Promise<void> {
  const { data: recentAttempts } = await supabase
    .from('rate_limits')
    .select('request_count')
    .eq('user_id', userId)
    .eq('endpoint', 'x402-verify-payment')
    .gte('window_start', new Date(Date.now() - 60000).toISOString())
    .single();

  if (recentAttempts && recentAttempts.request_count > 10) {
    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
  }

  await supabase.from('rate_limits').upsert({
    user_id: userId,
    ip_address: ipAddress,
    endpoint: 'x402-verify-payment',
    request_count: (recentAttempts?.request_count || 0) + 1,
    window_start: new Date(),
  });
}

// Retry logic for blockchain queries
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Max retries exceeded');
}

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Rate limiting
    const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
    await checkRateLimit(supabaseAdmin, user.id, ipAddress);

    const { transactionSignature, contentType, contentId, allowSingleTransferFallback } = await req.json();

    if (!transactionSignature || !contentType || !contentId) {
      throw new Error('Missing required fields: transactionSignature, contentType, contentId');
    }

    console.log('[X402-V2] Verifying payment:', { 
      transactionSignature, 
      contentType, 
      contentId, 
      userId: user.id,
      fallbackMode: allowSingleTransferFallback || false
    });

    // Get content details and price
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

    // Get creator's wallet address
    const { data: creatorWallet, error: walletError } = await supabaseAdmin
      .from('profile_wallets')
      .select('wallet_address')
      .eq('user_id', creatorId)
      .maybeSingle();

    if (walletError || !creatorWallet) {
      throw new Error('Creator wallet not found');
    }

    // Use Helius RPC with API key for better reliability
    const heliusApiKey = Deno.env.get('HELIUS_API_KEY');
    const rpcUrl = heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    
    const connection = new Connection(rpcUrl, 'confirmed');

    // Fetch transaction with retry logic
    console.log('[X402-V2] Fetching transaction with retry...');
    const transaction: any = await retryOperation(
      () => connection.getParsedTransaction(transactionSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized'
      })
    );

    if (!transaction) {
      return new Response(
        JSON.stringify({ 
          error: 'Transaction not found on blockchain after multiple retries. Please wait and try again.',
          signature: transactionSignature,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction success
    if (transaction.meta?.err) {
      throw new Error('Transaction failed on blockchain');
    }

    // Parse and verify transaction structure
    const instructions = transaction.transaction.message.instructions;
    let creatorAmountLamports = 0;
    let platformAmountLamports = 0;
    let transferCount = 0;
    
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
        const info = instruction.parsed.info;
        
        if (info.destination === creatorWallet.wallet_address) {
          creatorAmountLamports = info.lamports;
          transferCount++;
        } else if (info.destination === PLATFORM_WALLET) {
          platformAmountLamports = info.lamports;
          transferCount++;
        }
      }
    }

    const priceLamports = Math.round(price * LAMPORTS_PER_SOL);
    
    // Support two patterns:
    // 1. Two-transfer (95/5 split on-chain) - default
    // 2. Single-transfer (full amount to creator) - fallback for rent issues
    
    if (transferCount === 2) {
      // Normal two-transfer pattern
      const expectedCreatorLamports = Math.floor(priceLamports * 95 / 100);
      const expectedPlatformLamports = priceLamports - expectedCreatorLamports;

      if (creatorAmountLamports !== expectedCreatorLamports || platformAmountLamports !== expectedPlatformLamports) {
        throw new Error('Payment amounts do not match expected 95/5 split');
      }
      
      console.log('[X402-V2] Verified two-transfer pattern (95/5 on-chain)');
    } else if (transferCount === 1 && allowSingleTransferFallback) {
      // Single-transfer fallback pattern
      if (creatorAmountLamports !== priceLamports) {
        throw new Error(`Single transfer amount ${creatorAmountLamports} does not match price ${priceLamports}`);
      }
      
      // Calculate platform fee for off-chain accounting (5%)
      platformAmountLamports = Math.floor(priceLamports * 5 / 100);
      creatorAmountLamports = priceLamports - platformAmountLamports; // Adjust for accounting
      
      console.log('[X402-V2] Verified single-transfer fallback pattern (full amount to creator, 5% fee off-chain)');
    } else {
      throw new Error(`Invalid transaction structure. Expected 2 transfers or 1 transfer with fallback flag. Got ${transferCount} transfers, fallback=${allowSingleTransferFallback}`);
    }

    // Check if transaction already used
    const { data: existingTx } = await supabaseAdmin
      .from('platform_transactions')
      .select('id')
      .eq('transaction_signature', transactionSignature)
      .maybeSingle();

    if (existingTx) {
      throw new Error('Transaction already used');
    }

    // Record in platform_transactions (unified ledger)
    const { data: platformTx, error: txError } = await supabaseAdmin
      .from('platform_transactions')
      .insert({
        transaction_type: contentType === 'community_post' ? 'service_purchase' : 'x402_purchase',
        buyer_id: user.id,
        seller_id: creatorId,
        gross_amount: price,
        creator_amount: creatorAmountLamports / LAMPORTS_PER_SOL,
        platform_amount: platformAmountLamports / LAMPORTS_PER_SOL,
        transaction_signature: transactionSignature,
        buyer_wallet: transaction.transaction.message.accountKeys[0].pubkey.toString(),
        seller_wallet: creatorWallet.wallet_address,
        content_type: contentType,
        content_id: contentId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        metadata: {
          post_type: postType,
          block_time: transaction.blockTime,
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('[X402-V2] Error recording transaction:', txError);
      throw new Error('Failed to record transaction');
    }

    // Record in legacy tables for backwards compatibility
    if (contentType === 'community_post') {
      await supabaseClient
        .from('community_post_purchases')
        .insert({
          user_id: user.id,
          post_id: contentId,
          amount: price,
          asset: 'SOL',
          network: 'solana',
          payment_proof: JSON.stringify({
            creatorAmount: creatorAmountLamports / LAMPORTS_PER_SOL,
            platformAmount: platformAmountLamports / LAMPORTS_PER_SOL,
          }),
          transaction_signature: transactionSignature,
          is_active: true,
        });

      // Create service order if needed
      if (postType === 'service') {
        await supabaseClient
          .from('service_orders')
          .insert({
            purchase_id: platformTx.id,
            post_id: contentId,
            buyer_id: user.id,
            seller_id: creatorId,
            status: 'pending',
          });
      }
    } else {
      await supabaseClient
        .from('x402_purchases')
        .insert({
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          amount: price,
          asset: 'SOL',
          network: 'solana',
          payment_proof: JSON.stringify({
            creatorAmount: creatorAmountLamports / LAMPORTS_PER_SOL,
            platformAmount: platformAmountLamports / LAMPORTS_PER_SOL,
          }),
          transaction_signature: transactionSignature,
          is_active: true,
        });
    }

    // Record platform fee
    await supabaseAdmin.rpc('record_x402_fee', {
      p_amount: platformAmountLamports / LAMPORTS_PER_SOL,
      p_content_id: contentId,
      p_content_type: `x402_${contentType}`,
    });

    console.log('[X402-V2] Payment verified successfully');

    return new Response(
      JSON.stringify({
        success: true,
        purchase: {
          id: platformTx.id,
          contentType,
          contentId,
          amount: price,
          creatorAmount: creatorAmountLamports / LAMPORTS_PER_SOL,
          platformAmount: platformAmountLamports / LAMPORTS_PER_SOL,
        },
        transactionSignature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[X402-V2] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
