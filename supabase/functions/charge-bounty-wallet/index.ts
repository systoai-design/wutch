import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as web3 from "https://esm.sh/@solana/web3.js@1.98.4";
import { validateInput, bountyValidationSchema } from "../_shared/validation.ts";
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check rate limit
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const rateLimit = await checkRateLimit('charge-bounty-wallet', user.id, ipAddress);
    
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt);
    }

    const requestBody = await req.json();
    
    // Validate input using Zod schema
    const validatedData = validateInput(bountyValidationSchema, requestBody);
    
    const { amount, fromWalletAddress, toWalletAddress } = validatedData;

    // Connect to Solana using secure RPC endpoint
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL');
    if (!SOLANA_RPC_URL) {
      throw new Error('Solana RPC URL not configured');
    }
    
    const connection = new web3.Connection(SOLANA_RPC_URL, 'confirmed');

    // Validate wallet addresses
    let fromPubkey: web3.PublicKey;
    let toPubkey: web3.PublicKey;
    
    try {
      fromPubkey = new web3.PublicKey(fromWalletAddress);
      toPubkey = new web3.PublicKey(toWalletAddress);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Amount is in SOL, convert directly to lamports
    const lamports = Math.floor(amount * web3.LAMPORTS_PER_SOL);

    // Check if user has sufficient balance
    const balance = await connection.getBalance(fromPubkey);

    if (balance < lamports) {
      const errorResponse = {
        error: 'Insufficient balance',
        message: `You need ${amount} SOL but only have ${(balance / web3.LAMPORTS_PER_SOL).toFixed(4)} SOL`,
        required: lamports,
        available: balance,
        requiredSOL: amount,
        availableSOL: balance / web3.LAMPORTS_PER_SOL,
        hint: 'Please add SOL to your wallet to continue.'
      };
      
      return new Response(
        JSON.stringify(errorResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // For security, this transaction must be signed by the user on the client side
    // We return the transaction details for the client to sign
    const transaction = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Serialize transaction for client to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Convert to base64 using Deno's btoa
    const base64Transaction = btoa(
      String.fromCharCode(...new Uint8Array(serializedTransaction))
    );

    return new Response(
      JSON.stringify({
        success: true,
        transaction: base64Transaction,
        amount: amount,
        lamports,
        message: 'Transaction prepared. Please sign with your wallet.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error charging bounty wallet:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to prepare transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
