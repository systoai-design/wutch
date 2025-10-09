import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  code: string;
  type: 'username_change' | 'email_change';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get user from auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { code, type }: VerifyRequest = await req.json();

    if (!code || !type) {
      throw new Error("Missing required fields");
    }

    // Use service role key to query verification codes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find valid verification code
    const { data: verificationData, error: verifyError } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code', code)
      .eq('type', type)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (verifyError || !verificationData) {
      throw new Error("Invalid or expired verification code");
    }

    // Mark code as used
    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('id', verificationData.id);

    // Perform the update based on type
    if (type === 'username_change') {
      // Update username in profiles table
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ username: verificationData.new_value.toLowerCase() })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating username:', updateError);
        throw new Error("Failed to update username");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Username updated successfully",
          new_username: verificationData.new_value.toLowerCase()
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (type === 'email_change') {
      // Update email in auth.users
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { email: verificationData.new_value }
      );

      if (emailError) {
        console.error('Error updating email:', emailError);
        throw new Error("Failed to update email");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email updated successfully. Please sign in again with your new email.",
          new_email: verificationData.new_value
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    throw new Error("Invalid verification type");
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});