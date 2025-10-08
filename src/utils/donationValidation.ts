import { z } from 'zod';
import { isValidSolanaAddress } from './urlValidation';

// Donation validation schema
export const donationSchema = z.object({
  amount: z.number()
    .positive('Amount must be greater than 0')
    .min(0.001, 'Minimum donation is 0.001 SOL')
    .max(1000, 'Maximum donation is 1000 SOL')
    .finite('Amount must be a valid number'),
  
  walletAddress: z.string()
    .min(1, 'Wallet address is required')
    .refine(isValidSolanaAddress, 'Invalid Solana wallet address'),
  
  contentId: z.string().uuid('Invalid content ID'),
  
  contentType: z.enum(['livestream', 'shortvideo'], {
    errorMap: () => ({ message: 'Content type must be livestream or shortvideo' })
  }),
  
  recipientUserId: z.string().uuid('Invalid recipient user ID'),
  
  message: z.string()
    .max(500, 'Message must be less than 500 characters')
    .optional()
    .nullable(),
});

// Campaign creation validation schema
export const campaignSchema = z.object({
  rewardPerShare: z.number()
    .positive('Reward must be greater than 0')
    .min(0.0001, 'Minimum reward per share is 0.0001 SOL')
    .max(1, 'Maximum reward per share is 1 SOL')
    .finite('Reward must be a valid number'),
  
  totalBudget: z.number()
    .positive('Budget must be greater than 0')
    .min(0.01, 'Minimum budget is 0.01 SOL')
    .max(10000, 'Maximum budget is 10000 SOL')
    .finite('Budget must be a valid number'),
  
  maxSharesPerUser: z.number()
    .int('Max shares must be a whole number')
    .positive('Max shares must be greater than 0')
    .max(1000, 'Maximum shares per user is 1000')
    .optional()
    .nullable(),
  
  livestreamId: z.string().uuid('Invalid livestream ID'),
});

// Bounty claim validation schema
export const bountyClaimSchema = z.object({
  secretWord: z.string()
    .trim()
    .min(1, 'Secret word is required')
    .max(100, 'Secret word must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s-_]+$/, 'Secret word can only contain letters, numbers, spaces, hyphens and underscores'),
  
  walletAddress: z.string()
    .min(1, 'Wallet address is required')
    .refine(isValidSolanaAddress, 'Invalid Solana wallet address'),
  
  bountyId: z.string().uuid('Invalid bounty ID'),
});

export type DonationInput = z.infer<typeof donationSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type BountyClaimInput = z.infer<typeof bountyClaimSchema>;
