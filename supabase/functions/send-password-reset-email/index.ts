import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateEmailHtml(resetLink: string, userEmail: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px 30px;">
                    <h1 style="margin: 0 0 30px 0; font-size: 24px; font-weight: bold; color: #333;">Reset Your Password</h1>
                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #333;">Hi ${userEmail},</p>
                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #333;">We received a request to reset your Wutch password. Click the button below to create a new password:</p>
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td style="border-radius: 4px; background-color: #2754C5;">
                          <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 14px; color: #ffffff; text-decoration: none; font-weight: 500;">Reset Your Password</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0; font-size: 14px; line-height: 1.5; color: #333;">Or copy and paste this link into your browser:</p>
                    <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.5; color: #2754C5; word-break: break-all;">${resetLink}</p>
                    <p style="margin: 20px 0; font-size: 14px; line-height: 1.5; color: #333;">This link will expire in 1 hour.</p>
                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.5; color: #999;">If you didn't request a password reset, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #999;">Wutch - Watch and Earn</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(hookSecret)
    
    console.log('Received password reset webhook')
    
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
      }
    }

    console.log('Webhook verified for user:', user.email)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const resetLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    const html = generateEmailHtml(resetLink, user.email)

    console.log('Sending password reset email to:', user.email)

    const { data, error } = await resend.emails.send({
      from: 'Wutch <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Reset Your Wutch Password',
      html,
    })

    if (error) {
      console.error('Error sending email:', error)
      throw error
    }

    console.log('Email sent successfully:', data)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in send-password-reset-email function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: {
          message: errorMessage,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})