import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import React from "https://esm.sh/react@18.3.1";
import { renderAsync } from "https://esm.sh/@react-email/components@0.0.22";
import AuthEmail from "./_templates/auth-email.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);
  
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const html = await renderAsync(
      React.createElement(AuthEmail, {
        supabase_url: supabaseUrl,
        token,
        token_hash,
        redirect_to,
        email_action_type,
        user_email: user.email,
      })
    );

    const { error } = await resend.emails.send({
      from: "Wutch <no-reply@wutch.fun>",
      to: [user.email],
      subject:
        email_action_type === "signup"
          ? "Verify your Wutch account"
          : email_action_type === "recovery"
          ? "Reset your Wutch password"
          : "Sign in to Wutch",
      html,
    });

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.log(error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code,
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  });
});
