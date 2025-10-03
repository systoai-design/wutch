import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Twitter, DollarSign, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ShareAndEarnProps {
  livestreamId: string;
  streamTitle: string;
  streamUrl: string;
}

export const ShareAndEarn = ({ livestreamId, streamTitle, streamUrl }: ShareAndEarnProps) => {
  const [campaign, setCampaign] = useState<any>(null);
  const [userShares, setUserShares] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [hasWallet, setHasWallet] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Load campaign details
    const loadCampaign = async () => {
      const { data, error } = await supabase
        .from('sharing_campaigns')
        .select('*')
        .eq('livestream_id', livestreamId)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        setCampaign(data);
      }
    };

    // Check if user has wallet
    const checkWallet = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', user.id)
        .single();

      setHasWallet(!!data?.wallet_address);
    };

    // Load user's shares for this campaign
    const loadUserShares = async () => {
      if (!campaign) return;

      const { data, error } = await supabase
        .from('user_shares')
        .select('*')
        .eq('user_id', user.id)
        .eq('campaign_id', campaign.id);

      if (!error && data) {
        setUserShares(data.length);
        const earned = data.reduce((sum, share) => sum + Number(share.reward_amount), 0);
        setTotalEarned(earned);
      }
    };

    loadCampaign();
    checkWallet();
    loadUserShares();
  }, [user, livestreamId, campaign?.id]);

  const handleShare = async () => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to earn rewards for sharing.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasWallet) {
      toast({
        title: 'Wallet Required',
        description: 'Connect your Solana wallet to earn rewards!',
        variant: 'destructive',
      });
      return;
    }

    if (!campaign) {
      toast({
        title: 'No Active Campaign',
        description: 'This stream doesn\'t have an active sharing campaign.',
        variant: 'destructive',
      });
      return;
    }

    // Check if user exceeded max shares
    if (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user) {
      toast({
        title: 'Share Limit Reached',
        description: `You've reached the maximum of ${campaign.max_shares_per_user} shares for this stream.`,
        variant: 'destructive',
      });
      return;
    }

    // Create Twitter share URL
    const tweetText = encodeURIComponent(
      `Check out this stream on Wutch: ${streamTitle}\n\n${streamUrl}`
    );
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;

    // Open Twitter in new window
    const twitterWindow = window.open(twitterUrl, '_blank', 'width=550,height=420');

    // Record the share after a short delay (assume they shared)
    setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('user_shares')
          .insert({
            user_id: user.id,
            campaign_id: campaign.id,
            share_platform: 'twitter',
            share_url: twitterUrl,
            reward_amount: campaign.reward_per_share,
            status: 'verified',
          });

        if (error) throw error;

        setUserShares(prev => prev + 1);
        setTotalEarned(prev => prev + Number(campaign.reward_per_share));

        toast({
          title: 'Share Recorded! 🎉',
          description: `You've earned $${campaign.reward_per_share}! Rewards will be sent to your wallet.`,
        });
      } catch (error: any) {
        console.error('Error recording share:', error);
        toast({
          title: 'Error',
          description: error.message || 'Could not record your share',
          variant: 'destructive',
        });
      }
    }, 3000);
  };

  if (!campaign) {
    return null;
  }

  const remainingBudget = Number(campaign.total_budget) - Number(campaign.spent_budget);
  const remainingShares = Math.floor(remainingBudget / Number(campaign.reward_per_share));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share & Earn ${campaign.reward_per_share}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share & Earn Rewards</DialogTitle>
          <DialogDescription>
            Share this stream on Twitter/X and earn crypto rewards!
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Reward per share:</span>
            <div className="flex items-center gap-1 font-semibold">
              <DollarSign className="h-4 w-4" />
              {campaign.reward_per_share}
            </div>
          </div>

          {campaign.max_shares_per_user && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your shares:</span>
              <span className="font-semibold">
                {userShares} / {campaign.max_shares_per_user}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your total earned:</span>
            <div className="flex items-center gap-1 font-semibold text-green-600">
              <DollarSign className="h-4 w-4" />
              {totalEarned.toFixed(3)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Shares remaining:</span>
            <span className="font-semibold">{remainingShares}</span>
          </div>

          {!hasWallet && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <Wallet className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">
                Connect wallet to receive rewards
              </span>
            </div>
          )}
        </Card>

        <Button
          onClick={handleShare}
          disabled={!hasWallet || (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user)}
          className="w-full gap-2"
        >
          <Twitter className="h-4 w-4" />
          Share on Twitter/X
        </Button>
      </DialogContent>
    </Dialog>
  );
};
