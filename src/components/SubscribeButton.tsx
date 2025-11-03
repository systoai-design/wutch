import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Bell, Check, Loader2, Star } from 'lucide-react';
import { format } from 'date-fns';

interface SubscriptionTier {
  id: string;
  tier_name: string;
  tier_description: string | null;
  price_monthly: number;
  access_level: string;
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  subscription_id: string;
  expires_at: string;
  is_active: boolean;
}

interface SubscribeButtonProps {
  creatorId: string;
  creatorUsername: string;
  creatorWalletAddress: string | null;
}

export function SubscribeButton({ creatorId, creatorUsername, creatorWalletAddress }: SubscribeButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { publicKey, connect, connected } = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingTierId, setProcessingTierId] = useState<string | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      fetchTiers();
      if (user) {
        fetchUserSubscriptions();
      }
    }
  }, [dialogOpen, user]);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('creator_subscriptions')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (error: any) {
      console.error('Error fetching tiers:', error);
    }
  };

  const fetchUserSubscriptions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;
      setUserSubscriptions(data || []);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const hasActiveSub = (tierId: string) => {
    return userSubscriptions.some(sub => sub.subscription_id === tierId);
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to subscribe',
        variant: 'destructive',
      });
      return;
    }

    if (!creatorWalletAddress) {
      toast({
        title: 'Error',
        description: 'Creator has not set up their wallet yet',
        variant: 'destructive',
      });
      return;
    }

    if (!connected || !publicKey) {
      try {
        await connect();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to connect wallet',
          variant: 'destructive',
        });
      }
      return;
    }

    const walletAddress = publicKey.toBase58();

    setProcessingTierId(tier.id);
    setIsLoading(true);

    try {
      const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(creatorWalletAddress);
      const lamports = Math.floor(tier.price_monthly * 1_000_000_000);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const { solana } = window as any;
      if (!solana?.isPhantom) {
        throw new Error('Phantom wallet not found');
      }

      const signed = await solana.signAndSendTransaction(transaction);
      const signature = signed.signature;

      await connection.confirmTransaction(signature, 'confirmed');

      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      if (!authToken) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('verify-subscription-payment', {
        body: {
          subscriptionId: tier.id,
          transactionSignature: signature,
          fromWallet: walletAddress,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Verification failed');
      }

      toast({
        title: 'Success! 🎉',
        description: `You're now subscribed to ${tier.tier_name}`,
      });

      setDialogOpen(false);
      fetchUserSubscriptions();
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setProcessingTierId(null);
    }
  };

  const getAccessLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      all_content: 'All Premium Content',
      streams_only: 'Livestreams',
      videos_only: 'Videos',
      shorts_only: 'Shorts',
    };
    return labels[level] || level;
  };

  if (!user || user.id === creatorId) {
    return null;
  }

  const activeSubForCreator = userSubscriptions.find(sub => 
    tiers.some(t => t.id === sub.subscription_id)
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {activeSubForCreator ? (
            <>
              <Check className="w-4 h-4" />
              Subscribed
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Subscribe
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscribe to @{creatorUsername}</DialogTitle>
          <DialogDescription>
            Get unlimited access to premium content with a monthly subscription
          </DialogDescription>
        </DialogHeader>

        {tiers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No subscription tiers available yet
          </div>
        ) : (
          <div className="grid gap-4">
            {tiers.map((tier) => {
              const hasSubscription = hasActiveSub(tier.id);
              const activeSub = userSubscriptions.find(s => s.subscription_id === tier.id);

              return (
                <Card key={tier.id} className={hasSubscription ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {tier.tier_name}
                          {hasSubscription && (
                            <Badge variant="default">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {tier.tier_description || 'Monthly subscription'}
                        </CardDescription>
                      </div>
                      <Star className="w-5 h-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{tier.price_monthly}</span>
                      <span className="text-muted-foreground">SOL/month</span>
                    </div>

                    <div className="space-y-2">
                      <Badge variant="outline">{getAccessLevelLabel(tier.access_level)}</Badge>
                    </div>

                    {hasSubscription && activeSub ? (
                      <div className="text-sm text-muted-foreground">
                        Expires: {format(new Date(activeSub.expires_at), 'MMM d, yyyy')}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleSubscribe(tier)}
                        disabled={isLoading || !creatorWalletAddress}
                        className="w-full"
                      >
                        {processingTierId === tier.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>Subscribe Now</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Subscriptions renew monthly. You'll need to manually renew after 30 days.
        </div>
      </DialogContent>
    </Dialog>
  );
}
