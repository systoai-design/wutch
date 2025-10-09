import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.87.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_WALLET = "899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G";
const REQUIRED_AMOUNT = 0.05;

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { transactionSignature, walletAddress } = await req.json();

    if (!transactionSignature || !walletAddress) {
      throw new Error('Missing transaction signature or wallet address');
    }

    console.log('Verifying payment:', { transactionSignature, walletAddress });

    // Connect to Solana mainnet
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

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
    let recipientAddress = '';
    let amount = 0;

    // Parse transfer instruction
    for (const instruction of instructions) {
      if ('parsed' in instruction && instruction.parsed?.type === 'transfer') {
        const info = instruction.parsed.info;
        recipientAddress = info.destination;
        amount = info.lamports / LAMPORTS_PER_SOL;
      }
    }

    // Verify recipient is platform wallet
    if (recipientAddress !== PLATFORM_WALLET) {
      throw new Error(`Invalid recipient. Expected ${PLATFORM_WALLET}, got ${recipientAddress}`);
    }

    // Verify amount is exactly 0.05 SOL
    if (Math.abs(amount - REQUIRED_AMOUNT) > 0.0001) {
      throw new Error(`Invalid amount. Expected ${REQUIRED_AMOUNT} SOL, got ${amount} SOL`);
    }

    // Check if transaction already used
    const { data: existingRequest } = await supabaseClient
      .from('verification_requests')
      .select('id')
      .eq('payment_transaction_signature', transactionSignature)
      .maybeSingle();

    if (existingRequest) {
      throw new Error('Transaction already used for verification');
    }

    console.log('Payment verified successfully');

    return new Response(
      JSON.stringify({
        verified: true,
        amount,
        recipient: recipientAddress,
        transactionSignature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
