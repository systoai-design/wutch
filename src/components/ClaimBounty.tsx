import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trophy, Wallet, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';

type StreamBounty = Database['public']['Tables']['stream_bounties']['Row'];

interface ClaimBountyProps {
  livestreamId: string;
  watchTime: number;
  meetsMinimumWatchTime: boolean;
}

const ClaimBounty = ({ livestreamId, watchTime, meetsMinimumWatchTime }: ClaimBountyProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bounty, setBounty] = useState<StreamBounty | null>(null);
  const [secretWord, setSecretWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        }
      } catch (error) {
        console.error('Error fetching bounty:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBounty();
  }, [livestreamId, user]);

  const handleClaim = async () => {
    if (!user || !bounty) return;

    // Check wallet connection
    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile?.wallet_address) {
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
      const { data, error } = await supabase
        .from('bounty_claims')
        .insert({
          bounty_id: bounty.id,
          user_id: user.id,
          wallet_address: profile.wallet_address,
          submitted_word: secretWord.trim(),
        })
        .select()
        .single();

      if (error) {
        // Error message from trigger
        toast({
          title: 'Claim Failed',
          description: error.message || 'Failed to claim bounty. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      if (data.is_correct) {
        setHasClaimed(true);
        toast({
          title: 'Bounty Claimed! 🎉',
          description: `You've earned ${data.reward_amount} SOL! Check your wallet.`,
        });
        setSecretWord('');
      } else {
        toast({
          title: 'Incorrect Word',
          description: 'The secret word you entered is incorrect. Try again!',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error claiming bounty:', error);
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Reward per person</p>
          <p className="text-2xl font-bold text-primary flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {bounty.reward_per_participant} SOL
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Watch time</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {minutesWatched}/{minutesRequired} min
          </p>
        </div>
      </div>

      {hasClaimed ? (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-600 dark:text-green-400 font-medium text-center">
            ✓ You've already claimed this bounty!
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
                      handleClaim();
                    }
                  }}
                />
              </div>

              <Button 
                onClick={handleClaim} 
                disabled={isSubmitting || !secretWord.trim()}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? 'Claiming...' : `Claim ${bounty.reward_per_participant} SOL`}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Make sure your Solana wallet is connected to receive the reward
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default ClaimBounty;
