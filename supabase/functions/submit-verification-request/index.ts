import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const {
      verificationType,
      legalName,
      legalEmail,
      legalPhone,
      legalAddress,
      legalIdType,
      legalIdNumber,
      legalIdDocumentUrl,
      paymentTransactionSignature,
      paymentWalletAddress,
    } = await req.json();

    console.log('Submitting verification request:', { verificationType, userId: user.id });

    // Validate required fields
    if (!verificationType || !legalName || !legalEmail) {
      throw new Error('Missing required fields');
    }

    if (verificationType !== 'blue' && verificationType !== 'red') {
      throw new Error('Invalid verification type');
    }

    // For blue badge, verify payment was made
    if (verificationType === 'blue') {
      if (!paymentTransactionSignature || !paymentWalletAddress) {
        throw new Error('Payment information required for blue badge');
      }

      // Call verify-badge-payment to double-check
      const verifyResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-badge-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization')!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionSignature: paymentTransactionSignature,
            walletAddress: paymentWalletAddress,
          }),
        }
      );

      if (!verifyResponse.ok) {
        throw new Error('Payment verification failed');
      }
    }

    // For red badge, check eligibility
    let eligibilityData = null;
    if (verificationType === 'red') {
      const { data: eligibility, error: eligibilityError } = await supabaseClient
        .rpc('check_red_badge_eligibility', { p_user_id: user.id });

      if (eligibilityError) {
        console.error('Error checking eligibility:', eligibilityError);
        throw new Error('Failed to check eligibility');
      }

      eligibilityData = eligibility;

      if (!eligibilityData.eligible) {
        throw new Error(
          `Not eligible for red badge. Required: ${eligibilityData.required_watch_hours} hours and ${eligibilityData.required_followers} followers. Current: ${eligibilityData.total_watch_hours.toFixed(1)} hours and ${eligibilityData.follower_count} followers.`
        );
      }
    }

    // Check if user already has a pending or approved request for this type
    const { data: existingRequest } = await supabaseClient
      .from('verification_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('verification_type', verificationType)
      .maybeSingle();

    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        throw new Error(`You already have an approved ${verificationType} badge`);
      }
      if (existingRequest.status === 'pending' || existingRequest.status === 'under_review') {
        throw new Error(`You already have a pending ${verificationType} badge request`);
      }
      // If rejected, allow resubmission by deleting old request
      await supabaseClient
        .from('verification_requests')
        .delete()
        .eq('id', existingRequest.id);
    }

    // Create verification request
    const requestData: any = {
      user_id: user.id,
      verification_type: verificationType,
      legal_name: legalName,
      legal_email: legalEmail,
      legal_phone: legalPhone,
      legal_address: legalAddress,
      legal_id_type: legalIdType,
      legal_id_number: legalIdNumber,
      legal_id_document_url: legalIdDocumentUrl,
      status: 'pending',
    };

    if (verificationType === 'blue') {
      requestData.payment_transaction_signature = paymentTransactionSignature;
      requestData.payment_wallet_address = paymentWalletAddress;
      requestData.payment_verified_at = new Date().toISOString();
    }

    if (verificationType === 'red' && eligibilityData) {
      requestData.total_watch_hours = eligibilityData.total_watch_hours;
      requestData.follower_count_at_request = eligibilityData.follower_count;
      requestData.meets_eligibility_criteria = true;
    }

    const { data: newRequest, error: insertError } = await supabaseClient
      .from('verification_requests')
      .insert(requestData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating verification request:', insertError);
      throw insertError;
    }

    // Send notification to user
    await supabaseClient.rpc('create_notification', {
      p_user_id: user.id,
      p_type: 'verification_submitted',
      p_title: 'Verification Request Submitted',
      p_message: `Your ${verificationType} badge verification request has been submitted and is under review.`,
      p_metadata: { verification_type: verificationType, request_id: newRequest.id },
    });

    console.log('Verification request created:', newRequest.id);

    return new Response(
      JSON.stringify({ success: true, request: newRequest }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error submitting verification request:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
