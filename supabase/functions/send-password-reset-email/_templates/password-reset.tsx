import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetEmailProps {
  resetLink: string
  userEmail: string
}

export const PasswordResetEmail = ({
  resetLink,
  userEmail,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your Wutch password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset Your Password</Heading>
        <Text style={text}>
          Hi there,
        </Text>
        <Text style={text}>
          You recently requested to reset your password for your Wutch account ({userEmail}). 
          Click the button below to reset it.
        </Text>
        <Section style={buttonContainer}>
          <Link
            href={resetLink}
            target="_blank"
            style={button}
          >
            Reset Password
          </Link>
        </Section>
        <Text style={text}>
          This link will expire in 1 hour for security reasons.
        </Text>
        <Text style={textSecondary}>
          If you didn't request a password reset, you can safely ignore this email. 
          Your password will remain unchanged.
        </Text>
        <Text style={footer}>
          Best regards,
          <br />
          The Wutch Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
  borderRadius: '8px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  padding: '0',
  lineHeight: '1.3',
}

const text = {
  color: '#404040',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const textSecondary = {
  color: '#737373',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '16px 0',
}

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#9b87f5',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const footer = {
  color: '#737373',
  fontSize: '14px',
  lineHeight: '24px',
  marginTop: '32px',
  paddingTop: '32px',
  borderTop: '1px solid #e5e5e5',
}