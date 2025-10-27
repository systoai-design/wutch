import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  type: 'username_change' | 'email_change';
  new_value: string;
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

    // Get user from auth using Bearer token from header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { type, new_value }: VerificationRequest = await req.json();

    // Validate input
    if (!type || !new_value) {
      throw new Error("Missing required fields");
    }

    // For username change, check if username is already taken
    if (type === 'username_change') {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', new_value.toLowerCase())
        .single();

      if (existingUser) {
        throw new Error("Username already taken");
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(new_value)) {
        throw new Error("Username must be 3-30 characters and contain only letters, numbers, and underscores");
      }
    }

    // For email change, validate email format
    if (type === 'email_change') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(new_value)) {
        throw new Error("Invalid email format");
      }

      // Check if user is Gmail authenticated
      const provider = user.app_metadata?.provider;
      if (provider === 'google') {
        throw new Error("Cannot change email for Google authenticated accounts");
      }
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification code (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: insertError } = await supabaseAdmin
      .from('verification_codes')
      .insert({
        user_id: user.id,
        code,
        type,
        new_value,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error inserting verification code:', insertError);
      throw insertError;
    }

    // Send verification email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verification Code</h2>
        <p>You requested to change your ${type === 'username_change' ? 'username' : 'email address'}.</p>
        <p>Your verification code is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this change, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">Wutch - Your favorite streaming platform</p>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Wutch <noreply@wutch.fun>",
      to: [user.email!],
      subject: `Verification Code: ${code}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send verification email');
      throw new Error('Failed to send verification email. Please try again.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent to your email" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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