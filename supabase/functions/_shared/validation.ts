import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Solana wallet address validation
const solanaAddressSchema = z.string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format");

// Transaction signature validation
const transactionSignatureSchema = z.string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid transaction signature");

// UUID validation
const uuidSchema = z.string().uuid("Invalid UUID format");

// Donation validation schema
export const donationValidationSchema = z.object({
  amount: z.number()
    .positive("Amount must be positive")
    .min(0.001, "Minimum donation is 0.001 SOL")
    .max(1000, "Maximum donation is 1000 SOL"),
  donorWallet: solanaAddressSchema,
  recipientUserId: uuidSchema,
  contentId: uuidSchema,
  contentType: z.enum(['livestream', 'shortvideo', 'wutch_video']),
  transactionSignature: transactionSignatureSchema,
  message: z.string().max(500, "Message too long").optional()
});

// Bounty validation schema
export const bountyValidationSchema = z.object({
  amount: z.number()
    .positive("Amount must be positive")
    .min(0.01, "Minimum bounty deposit is 0.01 SOL")
    .max(100, "Maximum bounty deposit is 100 SOL"),
  fromWalletAddress: solanaAddressSchema,
  toWalletAddress: solanaAddressSchema,
  participantLimit: z.number()
    .int("Participant limit must be an integer")
    .min(1, "Minimum 1 participant")
    .max(1000, "Maximum 1000 participants"),
  rewardPerParticipant: z.number().positive().optional()
});

// Bounty claim validation schema
export const bountyClaimValidationSchema = z.object({
  bountyId: uuidSchema,
  userId: uuidSchema,
  walletAddress: solanaAddressSchema,
  submittedWord: z.string()
    .min(1, "Secret word cannot be empty")
    .max(100, "Secret word too long")
});

// Share payout validation schema
export const sharePayoutValidationSchema = z.object({
  shareId: uuidSchema,
  userId: uuidSchema,
  campaignId: uuidSchema
});

// Verification code validation schema
export const verificationCodeValidationSchema = z.object({
  type: z.enum(['email', 'username']),
  newValue: z.string().min(1, "Value cannot be empty").max(255, "Value too long")
});

// Helper function to validate and return typed data
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}
