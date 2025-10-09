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

    // Check if user is admin
    const { data: isAdmin } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const { requestId, action, rejectionReason } = await req.json();

    if (!requestId || !action) {
      throw new Error('Missing required fields');
    }

    if (action !== 'approve' && action !== 'reject') {
      throw new Error('Invalid action');
    }

    console.log('Processing verification request:', { requestId, action });

    // Get verification request
    const { data: request, error: fetchError } = await supabaseClient
      .from('verification_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new Error('Verification request not found');
    }

    if (request.status !== 'pending' && request.status !== 'under_review') {
      throw new Error('Request already processed');
    }

    // Update verification request
    const updateData: any = {
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    };

    if (action === 'approve') {
      updateData.status = 'approved';

      // Update profile verification
      const { error: updateError } = await supabaseClient
        .rpc('update_profile_verification', {
          p_user_id: request.user_id,
          p_verification_type: request.verification_type,
        });

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw new Error('Failed to update profile verification');
      }

      // Add to platform revenue pool for blue badge
      if (request.verification_type === 'blue' && request.payment_amount) {
        await supabaseClient.rpc('add_to_revenue_pool', {
          p_amount: request.payment_amount,
          p_fee_source: 'verification_badge',
          p_source_id: request.id,
        });
      }

      // Send success notification to user
      await supabaseClient.rpc('create_notification', {
        p_user_id: request.user_id,
        p_type: 'verification_approved',
        p_title: 'Verification Approved! ✅',
        p_message: `Congratulations! Your ${request.verification_type} badge verification has been approved.`,
        p_metadata: { verification_type: request.verification_type },
      });
    } else {
      updateData.status = 'rejected';
      updateData.rejection_reason = rejectionReason || 'No reason provided';

      // Send rejection notification to user
      await supabaseClient.rpc('create_notification', {
        p_user_id: request.user_id,
        p_type: 'verification_rejected',
        p_title: 'Verification Rejected',
        p_message: `Your ${request.verification_type} badge verification was not approved. Reason: ${updateData.rejection_reason}`,
        p_metadata: { verification_type: request.verification_type, reason: updateData.rejection_reason },
      });
    }

    const { error: updateRequestError } = await supabaseClient
      .from('verification_requests')
      .update(updateData)
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('Error updating request:', updateRequestError);
      throw updateRequestError;
    }

    console.log('Verification request processed successfully');

    return new Response(
      JSON.stringify({ success: true, action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing verification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
