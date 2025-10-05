import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DollarSign, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CreateSharingCampaignProps {
  livestreamId: string;
}

export const CreateSharingCampaign = ({ livestreamId }: CreateSharingCampaignProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    rewardPerShare: '0.005',
    totalBudget: '10',
    maxSharesPerUser: '5',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsCreating(true);

    try {
      const rewardPerShare = parseFloat(formData.rewardPerShare);
      const totalBudget = parseFloat(formData.totalBudget);
      const maxSharesPerUser = formData.maxSharesPerUser ? parseInt(formData.maxSharesPerUser) : null;

      if (rewardPerShare < 0.005) {
        throw new Error('Minimum reward per share is $0.005');
      }

      if (totalBudget <= 0) {
        throw new Error('Total budget must be greater than 0');
      }

      // Calculate platform fee (5%)
      const platformFee = totalBudget * 0.05;
      const totalWithFee = totalBudget + platformFee;

      // Step 1: Check for Phantom wallet
      const solana = (window as any).solana;
      if (!solana?.isPhantom) {
        throw new Error('Phantom wallet required to fund campaign');
      }

      if (!solana.isConnected) {
        await solana.connect();
      }

      toast({
        title: 'Preparing Deposit',
        description: `Please approve ${totalWithFee.toFixed(3)} SOL deposit (includes 5% platform fee)...`,
      });

      // Step 2: Call charge-bounty-wallet to prepare deposit transaction
      const ESCROW_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      
      const { data: txData, error: txError } = await supabase.functions.invoke(
        'charge-bounty-wallet',
        {
          body: {
            amount: totalWithFee,
            fromWalletAddress: solana.publicKey.toString(),
            toWalletAddress: ESCROW_WALLET
          }
        }
      );

      if (txError) throw txError;

      // Step 3: Import Solana web3 and sign transaction
      const { Transaction, Connection, clusterApiUrl } = await import('@solana/web3.js');
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      
      const transaction = Transaction.from(Buffer.from(txData.transaction, 'base64'));
      const signed = await solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      toast({
        title: 'Confirming Transaction',
        description: 'Waiting for blockchain confirmation...',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      // Step 4: Create campaign with escrow signature
      const { data: campaignData, error } = await supabase
        .from('sharing_campaigns')
        .insert({
          creator_id: user.id,
          livestream_id: livestreamId,
          reward_per_share: rewardPerShare,
          total_budget: totalBudget,
          max_shares_per_user: maxSharesPerUser,
          platform_fee_amount: platformFee,
          escrow_transaction_signature: signature,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Step 5: Add platform fee to revenue pool
      if (campaignData) {
        await supabase.rpc('add_to_revenue_pool', {
          p_amount: platformFee,
          p_fee_source: 'campaign',
          p_source_id: campaignData.id,
        });
      }

      toast({
        title: 'Campaign Created & Funded! 🎉',
        description: `${totalWithFee.toFixed(3)} SOL deposited. Users can now earn rewards by sharing!`,
      });

      setIsOpen(false);
      setFormData({
        rewardPerShare: '0.005',
        totalBudget: '10',
        maxSharesPerUser: '5',
      });
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not create campaign',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const estimatedShares = parseFloat(formData.totalBudget) / parseFloat(formData.rewardPerShare);
  const platformFee = parseFloat(formData.totalBudget) * 0.05;
  const totalCost = parseFloat(formData.totalBudget) + platformFee;

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
            Set rewards for users who share your stream on social media
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reward">Reward per Share (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reward"
                type="number"
                step="0.001"
                min="0.005"
                placeholder="0.005"
                value={formData.rewardPerShare}
                onChange={(e) => setFormData({ ...formData, rewardPerShare: e.target.value })}
                className="pl-9"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum: $0.005 per share
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Total Campaign Budget (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={formData.totalBudget}
                onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                className="pl-9"
                required
              />
            </div>
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
                <span className="text-muted-foreground">Estimated shares:</span>
                <span className="font-semibold">
                  {isNaN(estimatedShares) ? '0' : Math.floor(estimatedShares)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per share:</span>
                <span className="font-semibold">${formData.rewardPerShare}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign budget:</span>
                <span className="font-semibold">${formData.totalBudget}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee (5%):</span>
                <span className="font-semibold">${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span>Total Deposit:</span>
                <span className="text-primary">{totalCost.toFixed(3)} SOL</span>
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
