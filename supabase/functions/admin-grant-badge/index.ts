import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SERVER-SIDE ADMIN VALIDATION - CRITICAL SECURITY CHECK
    const { data: isAdmin, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Admin role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { verificationType } = await req.json();

    if (!verificationType || !['blue', 'red'].includes(verificationType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification type. Must be "blue" or "red"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if admin already has this badge
    const { data: existingProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('verification_type')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    if (existingProfile.verification_type === verificationType) {
      return new Response(
        JSON.stringify({ error: `You already have the ${verificationType} badge` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Directly update profile verification - NO VERIFICATION_REQUESTS TABLE
    const { error: updateError } = await supabaseClient
      .rpc('update_profile_verification', {
        p_user_id: user.id,
        p_verification_type: verificationType
      });

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw new Error(`Failed to grant badge: ${updateError.message}`);
    }

    // Log admin action for audit trail
    const { error: auditError } = await supabaseClient
      .from('admin_actions_log')
      .insert({
        admin_user_id: user.id,
        action_type: 'admin_self_granted_badge',
        target_user_id: user.id,
        action_details: {
          badge_type: verificationType,
          timestamp: new Date().toISOString(),
          bypassed_requirements: true,
          no_pii_collected: true
        },
        ip_address: req.headers.get('x-forwarded-for') || null,
        user_agent: req.headers.get('user-agent') || null
      });

    if (auditError) {
      console.error('Failed to log admin action:', auditError);
      // Don't fail the request, just log the error
    }

    console.log(`Admin ${user.id} granted themselves ${verificationType} badge`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} badge granted successfully`,
        verificationType
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in admin-grant-badge function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});