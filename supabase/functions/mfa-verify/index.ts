import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

interface MFAVerifyRequest {
  code: string;
  factorId: string;
  challengeId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { code, factorId, challengeId }: MFAVerifyRequest = await req.json();

    if (!code || !factorId || !challengeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for rate limiting checks
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check rate limiting
    const { data: attemptRecord } = await supabaseAdmin
      .from('mfa_verification_attempts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const now = new Date();

    if (attemptRecord) {
      // Check if account is locked
      if (attemptRecord.locked_until) {
        const lockedUntil = new Date(attemptRecord.locked_until);
        if (now < lockedUntil) {
          const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
          return new Response(
            JSON.stringify({ 
              error: `Too many failed attempts. Account locked for ${minutesRemaining} more minutes.`,
              locked_until: attemptRecord.locked_until
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Check if too many attempts
      if (attemptRecord.attempt_count >= MAX_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60000);
        await supabaseAdmin
          .from('mfa_verification_attempts')
          .update({
            locked_until: lockUntil.toISOString(),
            last_attempt_at: now.toISOString()
          })
          .eq('user_id', user.id);

        return new Response(
          JSON.stringify({ 
            error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
            locked_until: lockUntil.toISOString()
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify MFA code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    });

    if (verifyError) {
      // Increment failed attempts
      if (attemptRecord) {
        await supabaseAdmin
          .from('mfa_verification_attempts')
          .update({
            attempt_count: attemptRecord.attempt_count + 1,
            last_attempt_at: now.toISOString()
          })
          .eq('user_id', user.id);
      } else {
        await supabaseAdmin
          .from('mfa_verification_attempts')
          .insert({
            user_id: user.id,
            attempt_count: 1,
            last_attempt_at: now.toISOString()
          });
      }

      return new Response(
        JSON.stringify({ 
          error: verifyError.message || 'Invalid verification code',
          remaining_attempts: MAX_ATTEMPTS - ((attemptRecord?.attempt_count || 0) + 1)
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - clear attempts
    if (attemptRecord) {
      await supabaseAdmin
        .from('mfa_verification_attempts')
        .delete()
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('MFA verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
