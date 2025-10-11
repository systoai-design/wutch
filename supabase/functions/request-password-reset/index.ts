import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

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
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required')
    }

    console.log('Password reset requested for:', email)

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Generate password reset link - use request origin or fallback to site URL
    const origin = req.headers.get('origin') ?? Deno.env.get('SITE_URL') ?? 'https://wutch.fun'
    const redirectUrl = `${origin}/update-password`
    
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error) {
      console.error('Error generating reset link:', error)
      // Don't reveal if email exists - always return success
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists, reset email sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data.properties?.action_link) {
      console.error('No action link generated')
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists, reset email sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Reset link generated successfully')

    // Generate email HTML
    const html = generateEmailHtml(data.properties.action_link, email)

    console.log('Sending password reset email to:', email)

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Wutch <no-reply@wutch.fun>',
      to: [email],
      subject: 'Reset Your Wutch Password',
      html,
    })

    if (emailError) {
      console.error('Error sending email:', emailError)
      // Still return success to avoid user enumeration
    } else {
      console.log('Email sent successfully:', emailData)
    }

    // Always return success (security best practice - don't reveal if email exists)
    return new Response(
      JSON.stringify({ success: true, message: 'If an account exists, reset email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in request-password-reset function:', error)
    
    // Return generic success to avoid user enumeration
    return new Response(
      JSON.stringify({ success: true, message: 'If an account exists, reset email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
