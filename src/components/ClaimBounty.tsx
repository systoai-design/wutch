import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trophy, Wallet, Clock, Share2, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';
import { shareStreamToTwitter } from '@/utils/shareUtils';

type StreamBounty = Database['public']['Tables']['stream_bounties']['Row'];

interface ClaimBountyProps {
  livestreamId: string;
  watchTime: number;
  meetsMinimumWatchTime: boolean;
  streamTitle: string;
  creatorName: string;
}

const ClaimBounty = ({ livestreamId, watchTime, meetsMinimumWatchTime, streamTitle, creatorName }: ClaimBountyProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bounty, setBounty] = useState<StreamBounty | null>(null);
  const [secretWord, setSecretWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [hasClaimedWork, setHasClaimedWork] = useState(false);
  const [workClaimExpiresAt, setWorkClaimExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasShared, setHasShared] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const fetchBounty = async () => {
      if (!livestreamId) return;

      try {
        // Fetch active bounty for this stream
        const { data: bountyData, error: bountyError } = await supabase
          .from('stream_bounties')
          .select('*')
          .eq('livestream_id', livestreamId)
          .eq('is_active', true)
          .single();

        if (bountyError) {
          console.error('Error fetching bounty:', bountyError);
          setIsLoading(false);
          return;
        }

        setBounty(bountyData);

        // Check if user has already claimed
        if (user) {
          const { data: claimData } = await supabase
            .from('bounty_claims')
            .select('*')
            .eq('bounty_id', bountyData.id)
            .eq('user_id', user.id)
            .single();

          if (claimData) {
            setHasClaimed(true);
          }

          // Check if user has shared
          const { data: shareData } = await supabase
            .from('bounty_claim_shares')
            .select('*')
            .eq('bounty_id', bountyData.id)
            .eq('user_id', user.id)
            .single();

          if (shareData) {
            setHasShared(true);
          }
        }
      } catch (error) {
        console.error('Error fetching bounty:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBounty();
  }, [livestreamId, user]);

  const handleShare = async () => {
    if (!user || !bounty) return;

    setIsSharing(true);
    try {
      // Record the share
      const { error } = await supabase
        .from('bounty_claim_shares')
        .insert({
          user_id: user.id,
          bounty_id: bounty.id,
          livestream_id: livestreamId,
          share_platform: 'twitter',
        });

      if (error) throw error;

      // Open Twitter share
      shareStreamToTwitter({
        id: livestreamId,
        title: streamTitle,
        creatorName: creatorName,
      });

      setHasShared(true);
      toast({
        title: 'Share Recorded! ✓',
        description: 'You can now claim your bounty once watch time is met.',
      });
    } catch (error) {
      console.error('Error recording share:', error);
      toast({
        title: 'Error',
        description: 'Failed to record share. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleClaimWork = () => {
    if (!meetsMinimumWatchTime || !hasShared) return;
    
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes from now
    setHasClaimedWork(true);
    setWorkClaimExpiresAt(expiresAt);
    
    toast({
      title: 'Work Claimed! ✓',
      description: 'You have 5 minutes to claim your reward before it expires.',
      duration: 5000,
    });
  };

  const handleClaimReward = async () => {
    if (!user || !bounty || !hasClaimedWork) return;

    // Check if work claim has expired
    if (workClaimExpiresAt && Date.now() > workClaimExpiresAt) {
      toast({
        title: 'Claim Expired',
        description: 'Your work claim has expired. You need to watch again.',
        variant: 'destructive',
      });
      setHasClaimedWork(false);
      setWorkClaimExpiresAt(null);
      return;
    }

    // Check wallet connection
    const { data: walletRow } = await supabase
      .from('profile_wallets')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (!walletRow?.wallet_address) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your Solana wallet first.',
        variant: 'destructive',
      });
      return;
    }

    if (!secretWord.trim()) {
      toast({
        title: 'Secret Word Required',
        description: 'Please enter the secret word from the stream.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Call edge function to process payment
      const { data, error } = await supabase.functions.invoke('process-bounty-reward', {
        body: {
          bounty_id: bounty.id,
          user_id: user.id,
          wallet_address: walletRow.wallet_address,
          submitted_word: secretWord.trim(),
          watch_time_seconds: watchTime,
        },
      });

      if (error) {
        console.error('Claim error:', error);
        toast({
          title: 'Claim Failed',
          description: error.message || 'Failed to claim bounty. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Check for backend error in response
      if (data?.error) {
        toast({
          title: 'Claim Failed',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      if (data.success && data.is_correct) {
        setHasClaimed(true);
        toast({
          title: 'Reward Sent! 🎉',
          description: `${data.reward_amount} SOL has been sent to your wallet!`,
          duration: 6000,
        });
        setSecretWord('');
      } else if (!data.is_correct) {
        toast({
          title: 'Incorrect Word',
          description: 'The secret word you entered is incorrect. Try again!',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Claim Failed',
          description: data.message || 'Failed to process reward. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!bounty) {
    return null;
  }

  const spotsRemaining = bounty.participant_limit - bounty.claimed_count;
  const minutesRequired = 5;
  const minutesWatched = Math.floor(watchTime / 60);
  
  const timeUntilExpiration = workClaimExpiresAt ? Math.max(0, Math.floor((workClaimExpiresAt - Date.now()) / 1000)) : 0;
  const expirationMinutes = Math.floor(timeUntilExpiration / 60);
  const expirationSeconds = timeUntilExpiration % 60;

  return (
    <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/5 to-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-lg">Bounty Available</h3>
        </div>
        <Badge variant="secondary">
          {spotsRemaining} spots left
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Share Requirement Card */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Share Stream</p>
          <div className="flex items-center gap-2">
            {hasShared ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                Shared ✓
              </Badge>
            ) : (
              <Button
                onClick={handleShare}
                disabled={isSharing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Twitter className="h-4 w-4" />
                {isSharing ? 'Sharing...' : 'Share to Qualify'}
              </Button>
            )}
          </div>
        </div>
        
        {/* Watch Time Display */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Watch time</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {minutesWatched}/{minutesRequired} min
          </p>
        </div>
      </div>

      {/* Requirements Alert */}
      {!hasShared && !hasClaimed && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must share the stream on Twitter/X before you can claim the bounty.
          </AlertDescription>
        </Alert>
      )}

      {hasClaimed ? (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-600 dark:text-green-400 font-medium text-center">
            ✓ You've already claimed this bounty and received your reward!
          </p>
        </div>
      ) : hasClaimedWork ? (
        <div className="space-y-3">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="font-medium text-primary text-center mb-2">
              ⏰ Work Claimed! Time Remaining: {expirationMinutes}:{expirationSeconds.toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Enter the secret word to claim your reward
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="secretWord" className="text-sm font-medium">
              Enter the secret word from the stream:
            </label>
            <Input
              id="secretWord"
              type="text"
              placeholder="Type the secret word here..."
              value={secretWord}
              onChange={(e) => setSecretWord(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  handleClaimReward();
                }
              }}
            />
          </div>

          <Button 
            onClick={handleClaimReward} 
            disabled={isSubmitting || !secretWord.trim() || timeUntilExpiration === 0}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Processing...' : `Claim ${bounty.reward_per_participant} SOL Reward`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Reward will be automatically sent to your connected wallet
          </p>
        </div>
      ) : (
        <>
          {!meetsMinimumWatchTime ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  Keep watching to unlock bounty!
                </p>
                <p className="text-sm text-muted-foreground">
                  You need {minutesRequired - minutesWatched} more minutes of watch time before you can claim this bounty.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-600 dark:text-green-400 font-medium text-center mb-2">
                  ✓ Watch Time Complete!
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Click below to claim your work. You'll have 5 minutes to enter the secret word.
                </p>
              </div>

              <Button 
                onClick={handleClaimWork} 
                className="w-full"
                size="lg"
              >
                Claim Work
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                After claiming work, you'll have 5 minutes to submit the secret word
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default ClaimBounty;
