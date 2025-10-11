import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "https://esm.sh/@react-email/components@0.0.22";
import * as React from "https://esm.sh/react@18.3.1";

interface AuthEmailProps {
  supabase_url: string;
  email_action_type: string;
  redirect_to: string;
  token_hash: string;
  token: string;
  user_email: string;
}

export const AuthEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
  user_email,
}: AuthEmailProps) => {
  const actionText =
    email_action_type === "signup"
      ? "Verify your email"
      : email_action_type === "recovery"
      ? "Reset your password"
      : "Sign in";

  const heading =
    email_action_type === "signup"
      ? "Welcome to Wutch!"
      : email_action_type === "recovery"
      ? "Reset Your Password"
      : "Sign In to Wutch";

  const message =
    email_action_type === "signup"
      ? "Thanks for signing up! Click the button below to verify your email and start earning crypto rewards."
      : email_action_type === "recovery"
      ? "We received a request to reset your Wutch password. Click the button below to create a new password."
      : "Click the button below to sign in to your Wutch account.";

  return (
    <Html>
      <Head />
      <Preview>{actionText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={{ ...text, marginBottom: "14px" }}>Hi {user_email},</Text>
          <Text style={{ ...text, marginBottom: "14px" }}>{message}</Text>
          <Link
            href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
            target="_blank"
            style={{
              ...link,
              display: "block",
              marginBottom: "16px",
            }}
          >
            Click here to {actionText.toLowerCase()}
          </Link>
          <Text style={{ ...text, marginBottom: "14px" }}>
            Or, copy and paste this temporary code:
          </Text>
          <code style={code}>{token}</code>
          <Text
            style={{
              ...text,
              color: "#ababab",
              marginTop: "14px",
              marginBottom: "16px",
            }}
          >
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            <Link
              href="https://wutch.fun"
              target="_blank"
              style={{ ...link, color: "#898989" }}
            >
              Wutch
            </Link>
            , Watch and Earn
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default AuthEmail;

const main = {
  backgroundColor: "#ffffff",
};

const container = {
  paddingLeft: "12px",
  paddingRight: "12px",
  margin: "0 auto",
};

const h1 = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
};

const link = {
  color: "#2754C5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  textDecoration: "underline",
};

const text = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  margin: "24px 0",
};

const footer = {
  color: "#898989",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "12px",
  lineHeight: "22px",
  marginTop: "12px",
  marginBottom: "24px",
};

const code = {
  display: "inline-block",
  padding: "16px 4.5%",
  width: "90.5%",
  backgroundColor: "#f4f4f4",
  borderRadius: "5px",
  border: "1px solid #eee",
  color: "#333",
};
