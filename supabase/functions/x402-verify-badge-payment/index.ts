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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin to determine required amount
    const { data: isAdmin } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    const REQUIRED_AMOUNT = isAdmin ? 0.001 : 0.05;
    const CREATOR_AMOUNT = REQUIRED_AMOUNT * 0.95; // 95%
    const PLATFORM_AMOUNT = REQUIRED_AMOUNT * 0.05; // 5%

    const { transactionSignature, walletAddress } = await req.json();

    if (!transactionSignature || !walletAddress) {
      throw new Error('Missing transaction signature or wallet address');
    }

    console.log('Verifying badge payment:', { transactionSignature, walletAddress, REQUIRED_AMOUNT });

    // Connect to Solana mainnet
    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=' + Deno.env.get('HELIUS_API_KEY'), 'confirmed');

    // Get transaction details with retry logic
    let transaction = null;
    let retries = 3;
    
    while (retries > 0 && !transaction) {
      try {
        transaction = await connection.getParsedTransaction(transactionSignature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });
        
        if (!transaction) {
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!transaction) {
      throw new Error('Transaction not found on blockchain after retries');
    }

    // Verify transaction is confirmed
    if (transaction.meta?.err) {
      throw new Error('Transaction failed on blockchain');
    }

    // Extract transaction details
    const instructions = transaction.transaction.message.instructions;
    let amount = 0;
    let recipientFound = false;

    // Parse transfer instruction
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
        const info = instruction.parsed.info;
        const destination = info.destination;
        const transferAmount = info.lamports / LAMPORTS_PER_SOL;
        
        if (destination === PLATFORM_WALLET) {
          recipientFound = true;
          amount += transferAmount;
        }
      }
    }

    // Verify recipient is platform wallet
    if (!recipientFound) {
      throw new Error(`Invalid recipient. Expected ${PLATFORM_WALLET}`);
    }

    // Verify amount matches required amount (allow small tolerance for rounding)
    if (Math.abs(amount - REQUIRED_AMOUNT) > 0.0001) {
      throw new Error(`Invalid amount. Expected ${REQUIRED_AMOUNT} SOL, got ${amount} SOL`);
    }

    // Check if transaction already used for any verification
    const { data: existingRequest } = await supabaseClient
      .from('verification_requests')
      .select('id')
      .eq('payment_transaction_signature', transactionSignature)
      .maybeSingle();

    if (existingRequest) {
      throw new Error('Transaction already used for verification');
    }

    // Check if transaction already recorded in platform_transactions
    const { data: existingTransaction } = await supabaseClient
      .from('platform_transactions')
      .select('id')
      .eq('transaction_signature', transactionSignature)
      .maybeSingle();

    if (existingTransaction) {
      throw new Error('Transaction already recorded');
    }

    // Record the badge verification payment in platform_transactions
    const { error: transactionError } = await supabaseClient
      .from('platform_transactions')
      .insert({
        buyer_id: user.id,
        seller_id: null, // Platform is the recipient
        gross_amount: REQUIRED_AMOUNT,
        creator_amount: CREATOR_AMOUNT,
        platform_amount: PLATFORM_AMOUNT,
        transaction_type: 'badge_verification',
        transaction_signature: transactionSignature,
        status: 'confirmed',
        metadata: {
          wallet_address: walletAddress,
          admin_discount: isAdmin,
          verified_at: new Date().toISOString()
        }
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      throw new Error('Failed to record transaction');
    }

    // Add to revenue pool
    await supabaseClient.rpc('add_to_revenue_pool', {
      p_amount: PLATFORM_AMOUNT,
      p_fee_source: 'badge_verification',
      p_source_id: user.id
    });

    console.log('Badge payment verified successfully');

    return new Response(
      JSON.stringify({
        verified: true,
        amount,
        recipient: PLATFORM_WALLET,
        transactionSignature,
        creator_amount: CREATOR_AMOUNT,
        platform_amount: PLATFORM_AMOUNT,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying badge payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
