-- Update sharing_campaigns constraint to allow smaller rewards (0.0001 SOL minimum instead of 0.005)
-- This enables micro-rewards for share campaigns

-- Drop the old constraint
ALTER TABLE public.sharing_campaigns 
DROP CONSTRAINT IF EXISTS positive_reward;

-- Add new constraint with lower minimum (0.0001 SOL = $0.01 at $100/SOL)
ALTER TABLE public.sharing_campaigns 
ADD CONSTRAINT positive_reward CHECK (reward_per_share >= 0.0001);