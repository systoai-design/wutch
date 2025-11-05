import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Share2, Twitter, Facebook, Instagram } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { campaignSchema } from '@/utils/donationValidation';
import { z } from 'zod';
import { PLATFORM_NAMES } from '@/utils/platformUrlParsers';

interface CreateSharingCampaignProps {
  contentId: string;
  contentType: 'livestream' | 'short_video' | 'wutch_video';
  contentTitle: string;
}

export const CreateSharingCampaign = ({ contentId, contentType, contentTitle }: CreateSharingCampaignProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    rewardPerShare: '0.001',
    totalBudget: '0.1',
    maxSharesPerUser: '5',
    allowedPlatforms: ['twitter'] as string[],
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);

    try {
      const rewardPerShare = parseFloat(formData.rewardPerShare);
      const totalBudget = parseFloat(formData.totalBudget);
      const maxSharesPerUser = formData.maxSharesPerUser ? parseInt(formData.maxSharesPerUser) : null;

      // Input validation using Zod schema
      try {
        campaignSchema.parse({
          rewardPerShare,
          totalBudget,
          maxSharesPerUser,
          livestreamId: contentId, // Use contentId for validation
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          throw new Error(firstError.message);
        }
        throw error;
      }

      // Calculate platform fee (5%) - deducted FROM the total budget
      const totalDeposit = totalBudget;
      const platformFee = totalDeposit * 0.05;
      const availableForRewards = totalDeposit - platformFee;

      // Step 1: Check for Phantom wallet
      const solana = (window as any).solana;
      if (!solana?.isPhantom) {
        throw new Error('Phantom wallet required to fund campaign');
      }

      if (!solana.isConnected) {
        await solana.connect();
      }

      toast({
        title: 'Checking Balance',
        description: 'Verifying wallet funds...',
      });

      // Step 2: Check balance before attempting transaction
      const { Connection, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = new Connection(
        'https://mainnet.helius-rpc.com/?api-key=a181d89a-54f8-4a83-a857-a760d595180f',
        'confirmed'
      );
      const balance = await connection.getBalance(solana.publicKey);
      const balanceInSOL = balance / LAMPORTS_PER_SOL;

    if (balanceInSOL < totalDeposit) {
      throw new Error(
        `Insufficient balance. You need ${totalDeposit.toFixed(4)} SOL but only have ${balanceInSOL.toFixed(4)} SOL. Please add SOL to your wallet.`
      );
    }

      toast({
        title: 'Preparing Deposit',
        description: `Please approve ${totalDeposit.toFixed(4)} SOL deposit (5% platform fee will be deducted)...`,
      });

      // Step 3: Call charge-bounty-wallet to prepare deposit transaction
      const ESCROW_WALLET = 'DzrB51hp4RoR8ctsbKeuyJHe4KXr24cGewyTucBZezrF';
      
      const { data: txData, error: txError } = await supabase.functions.invoke(
        'charge-bounty-wallet',
        {
          body: {
            amount: totalDeposit,
            fromWalletAddress: solana.publicKey.toString(),
            toWalletAddress: ESCROW_WALLET
          }
        }
      );

      // Improved error handling
      if (txError || !txData) {
        console.error('Transaction preparation error:', txError);
        
        let errorMessage = 'Failed to prepare transaction';
        
        if (txError?.message) {
          errorMessage = txError.message;
        }
        
        // Check if there's error data in the response
        if (txData?.error) {
          errorMessage = txData.error;
          
          // Special handling for insufficient balance
          if (txData.availableSOL !== undefined) {
            errorMessage = `Insufficient balance. Required: ${txData.requiredSOL} SOL, Available: ${txData.availableSOL.toFixed(4)} SOL.`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Step 4: Import Solana web3 and sign transaction
      const { Transaction } = await import('@solana/web3.js');
      
      const transaction = Transaction.from(Buffer.from(txData.transaction, 'base64'));
      const signed = await solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      toast({
        title: 'Confirming Transaction',
        description: 'Waiting for blockchain confirmation...',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      // Step 5: Create campaign with escrow signature
      const { data: campaignData, error } = await supabase
        .from('sharing_campaigns')
        .insert({
          creator_id: user.id,
          content_id: contentId,
          content_type: contentType,
          livestream_id: contentType === 'livestream' ? contentId : null, // Backward compatibility
          reward_per_share: rewardPerShare,
          total_budget: totalBudget,
          max_shares_per_user: maxSharesPerUser,
          platform_fee_amount: platformFee,
          escrow_transaction_signature: signature,
          is_active: true,
          allowed_platforms: formData.allowedPlatforms,
        })
        .select()
        .single();

      if (error) throw error;

      // Step 6: Add platform fee to revenue pool
      if (campaignData) {
        await supabase.rpc('add_to_revenue_pool', {
          p_amount: platformFee,
          p_fee_source: 'campaign',
          p_source_id: campaignData.id,
        });
      }

      toast({
        title: 'Campaign Created & Funded! 🎉',
        description: `${totalDeposit.toFixed(4)} SOL deposited. Users can now earn rewards by sharing!`,
      });

      setIsOpen(false);
      setFormData({
        rewardPerShare: '0.001',
        totalBudget: '0.1',
        maxSharesPerUser: '5',
        allowedPlatforms: ['twitter'],
      });
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      
      const description = error.message || 'Could not create campaign';
      
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const totalDeposit = parseFloat(formData.totalBudget);
  const platformFee = totalDeposit * 0.05;
  const availableForRewards = totalDeposit - platformFee;
  const estimatedShares = availableForRewards / parseFloat(formData.rewardPerShare);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="h-4 w-4" />
          Create Share Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sharing Campaign</DialogTitle>
          <DialogDescription>
            Reward your community for sharing "{contentTitle}". Set a budget and reward amount, 
            and viewers can earn SOL for verified shares on social media.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label>Allowed Platforms</Label>
            <div className="space-y-2">
              {['twitter', 'facebook', 'instagram', 'tiktok'].map((platform) => (
                <div key={platform} className="flex items-center space-x-2">
                  <Checkbox
                    id={platform}
                    checked={formData.allowedPlatforms.includes(platform)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          allowedPlatforms: [...formData.allowedPlatforms, platform],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          allowedPlatforms: formData.allowedPlatforms.filter((p) => p !== platform),
                        });
                      }
                    }}
                  />
                  <label
                    htmlFor={platform}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {PLATFORM_NAMES[platform] || platform}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select which platforms users can share on to earn rewards
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward">Reward per Share (SOL)</Label>
            <Input
              id="reward"
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="0.001"
              value={formData.rewardPerShare}
              onChange={(e) => setFormData({ ...formData, rewardPerShare: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum: 0.0001 SOL per share
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Total Campaign Budget (SOL)</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.1"
              value={formData.totalBudget}
              onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxShares">Max Shares per User (Optional)</Label>
            <Input
              id="maxShares"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={formData.maxSharesPerUser}
              onChange={(e) => setFormData({ ...formData, maxSharesPerUser: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for unlimited shares
            </p>
          </div>

          <Card className="p-4 bg-muted/50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Deposit:</span>
                <span className="font-semibold text-primary">{totalDeposit.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (5%):</span>
                <span className="font-semibold">-{platformFee.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Available for Rewards:</span>
                <span className="font-semibold">{availableForRewards.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reward per Share:</span>
                <span className="font-semibold">{formData.rewardPerShare} SOL</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span>Estimated Shares:</span>
                <span className="text-primary">
                  {isNaN(estimatedShares) ? '0' : Math.floor(estimatedShares)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  💡 The 5% platform fee helps fund view earnings and maintain the platform
                </p>
              </div>
            </div>
          </Card>

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? 'Creating Campaign...' : 'Create Campaign'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
