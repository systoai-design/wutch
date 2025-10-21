import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as web3 from "https://esm.sh/@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, fromWalletAddress, toWalletAddress } = await req.json();
    
    console.log('Charging bounty wallet:', { amount, fromWalletAddress, toWalletAddress });

    if (!amount || !fromWalletAddress || !toWalletAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate amount is positive
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Connect to Solana using secure RPC endpoint
    const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
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

    console.log(`Processing ${amount} SOL (${lamports} lamports)`);

    // Check if user has sufficient balance
    const balance = await connection.getBalance(fromPubkey);
    console.log(`User balance: ${balance} lamports`);

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
      
      console.error('Insufficient balance:', errorResponse);
      
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