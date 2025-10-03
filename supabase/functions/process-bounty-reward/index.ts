import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from 'https://esm.sh/@solana/web3.js@1.87.6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    const { bounty_id, user_id, wallet_address, submitted_word, watch_time_seconds } = await req.json()

    console.log('Processing bounty reward:', { bounty_id, user_id, wallet_address, watch_time_seconds })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user || user.id !== user_id) {
      throw new Error('Unauthorized')
    }

    // Fetch bounty details
    const { data: bounty, error: bountyError } = await supabaseClient
      .from('stream_bounties')
      .select('*')
      .eq('id', bounty_id)
      .eq('is_active', true)
      .single()

    if (bountyError || !bounty) {
      throw new Error('Bounty not found or inactive')
    }

    // Check if user already claimed
    const { data: existingClaim } = await supabaseClient
      .from('bounty_claims')
      .select('*')
      .eq('bounty_id', bounty_id)
      .eq('user_id', user_id)
      .single()

    if (existingClaim) {
      return new Response(
        JSON.stringify({ success: false, message: 'You have already claimed this bounty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if bounty is full
    if (bounty.claimed_count >= bounty.participant_limit) {
      return new Response(
        JSON.stringify({ success: false, message: 'Bounty limit reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify secret word (case-insensitive)
    const isCorrect = submitted_word.toLowerCase().trim() === bounty.secret_word.toLowerCase().trim()

    // Verify watch time requirement (5 minutes = 300 seconds)
    const meetsWatchRequirement = watch_time_seconds >= 300

    if (!isCorrect) {
      // Record failed attempt
      await supabaseClient
        .from('bounty_claims')
        .insert({
          bounty_id,
          user_id,
          wallet_address,
          submitted_word,
          is_correct: false,
          meets_watch_requirement: meetsWatchRequirement,
          watch_time_seconds,
          reward_amount: 0,
        })

      return new Response(
        JSON.stringify({ success: false, is_correct: false, message: 'Incorrect secret word' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!meetsWatchRequirement) {
      return new Response(
        JSON.stringify({ success: false, message: 'Minimum watch time not met' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process Solana payment
    const ESCROW_PRIVATE_KEY = Deno.env.get('ESCROW_WALLET_PRIVATE_KEY')
    if (!ESCROW_PRIVATE_KEY) {
      throw new Error('Escrow wallet not configured')
    }

    // Parse private key
    const secretKey = Uint8Array.from(JSON.parse(ESCROW_PRIVATE_KEY))
    const escrowKeypair = Keypair.fromSecretKey(secretKey)

    // Connect to Solana (mainnet-beta or devnet)
    const SOLANA_RPC = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com'
    const connection = new Connection(SOLANA_RPC, 'confirmed')

    // Create recipient public key
    const recipientPubkey = new PublicKey(wallet_address)

    // Calculate amount in lamports
    const amountLamports = Math.floor(bounty.reward_per_participant * LAMPORTS_PER_SOL)

    console.log('Sending transaction:', {
      from: escrowKeypair.publicKey.toString(),
      to: recipientPubkey.toString(),
      amount: bounty.reward_per_participant,
      lamports: amountLamports,
    })

    // Create and send transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrowKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: amountLamports,
      })
    )

    const signature = await connection.sendTransaction(transaction, [escrowKeypair])
    await connection.confirmTransaction(signature, 'confirmed')

    console.log('Transaction confirmed:', signature)

    // Record successful claim
    const { error: claimError } = await supabaseClient
      .from('bounty_claims')
      .insert({
        bounty_id,
        user_id,
        wallet_address,
        submitted_word,
        is_correct: true,
        meets_watch_requirement: true,
        watch_time_seconds,
        reward_amount: bounty.reward_per_participant,
        transaction_signature: signature,
      })

    if (claimError) {
      console.error('Error recording claim:', claimError)
      throw claimError
    }

    // Update bounty claimed count
    await supabaseClient
      .from('stream_bounties')
      .update({ claimed_count: bounty.claimed_count + 1 })
      .eq('id', bounty_id)

    return new Response(
      JSON.stringify({
        success: true,
        is_correct: true,
        reward_amount: bounty.reward_per_participant,
        transaction_signature: signature,
        message: 'Reward sent successfully!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing bounty reward:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})