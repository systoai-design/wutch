import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from 'npm:@solana/web3.js@1.98.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Wallet address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking balance for wallet: ${walletAddress}`);

    // Use server-side RPC with API key for reliable balance checking
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const publicKey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(publicKey);
    const balanceInSol = balance / LAMPORTS_PER_SOL;

    console.log(`Balance for ${walletAddress}: ${balanceInSol} SOL (${balance} lamports)`);

    return new Response(
      JSON.stringify({ 
        balance: balanceInSol,
        lamports: balance,
        rpcEndpoint: rpcUrl.includes('helius') ? 'helius' : 'public'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error checking balance:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to check balance' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
