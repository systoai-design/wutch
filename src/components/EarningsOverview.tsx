import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EarningsOverviewProps {
  userId: string;
}

interface PayoutHistory {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  transaction_signature: string | null;
}

export function EarningsOverview({ userId }: EarningsOverviewProps) {
  const { toast } = useToast();
  const [pendingEarnings, setPendingEarnings] = useState<number>(0);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [lastPayoutAt, setLastPayoutAt] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([]);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [minPayoutAmount, setMinPayoutAmount] = useState<number>(10);

  useEffect(() => {
    fetchEarningsData();
    fetchPayoutHistory();
    fetchMinimumPayout();
  }, [userId]);

  const fetchEarningsData = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('pending_earnings, total_earnings, last_payout_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching earnings:', error);
      return;
    }

    if (data) {
      setPendingEarnings(Number(data.pending_earnings) || 0);
      setTotalEarnings(Number(data.total_earnings) || 0);
      setLastPayoutAt(data.last_payout_at);
    }
  };

  const fetchPayoutHistory = async () => {
    const { data, error } = await supabase
      .from('payouts')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching payout history:', error);
      return;
    }

    setPayoutHistory(data || []);
  };

  const fetchMinimumPayout = async () => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'minimum_payout')
      .single();

    if (!error && data && typeof data.setting_value === 'object' && data.setting_value !== null) {
      const settingValue = data.setting_value as { amount?: number };
      setMinPayoutAmount(settingValue.amount || 10);
    }
  };

  const handleRequestPayout = async () => {
    if (pendingEarnings < minPayoutAmount) {
      toast({
        title: 'Insufficient Balance',
        description: `Minimum payout amount is ${minPayoutAmount} SOL`,
        variant: 'destructive',
      });
      return;
    }

    if (!walletAddress || !walletAddress.trim()) {
      toast({
        title: 'Wallet Required',
        description: 'Please enter your wallet address',
        variant: 'destructive',
      });
      return;
    }

    setIsRequestingPayout(true);

    try {
      const { error } = await supabase
        .from('payouts')
        .insert({
          user_id: userId,
          amount: pendingEarnings,
          wallet_address: walletAddress,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Payout Requested',
        description: 'Your payout request has been submitted and will be processed within 24-48 hours.',
      });

      fetchEarningsData();
      fetchPayoutHistory();
    } catch (error: any) {
      console.error('Error requesting payout:', error);
      toast({
        title: 'Request Failed',
        description: error.message || 'Failed to request payout',
        variant: 'destructive',
      });
    } finally {
      setIsRequestingPayout(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Pending Earnings */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Earnings</p>
              <p className="text-2xl font-bold mt-2">{pendingEarnings.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground mt-1">
                ≈ ${(pendingEarnings * 100).toFixed(2)} USD
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                className="w-full mt-4" 
                disabled={pendingEarnings < minPayoutAmount}
              >
                <Download className="h-4 w-4 mr-2" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payout</DialogTitle>
                <DialogDescription>
                  Enter your Solana wallet address to receive {pendingEarnings.toFixed(4)} SOL.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="wallet">Wallet Address</Label>
                  <Input
                    id="wallet"
                    placeholder="Your Solana wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <Alert>
                  <AlertDescription>
                    Payouts are processed within 24-48 hours. A 5% platform fee will be deducted.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button onClick={handleRequestPayout} disabled={isRequestingPayout}>
                  {isRequestingPayout ? 'Processing...' : 'Confirm Payout'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {pendingEarnings < minPayoutAmount && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Minimum: {minPayoutAmount} SOL
            </p>
          )}
        </Card>

        {/* Total Earnings */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold mt-2">{totalEarnings.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        {/* Last Payout */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Payout</p>
              <p className="text-xl font-bold mt-2">
                {lastPayoutAt 
                  ? new Date(lastPayoutAt).toLocaleDateString()
                  : 'No payouts yet'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {lastPayoutAt && new Date(lastPayoutAt).toLocaleTimeString()}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Earnings Info */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">How Earnings Work</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
            <p>
              <strong>Donations:</strong> Receive 95% of all donations (5% platform fee)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
            <p>
              <strong>Bounties:</strong> 100% of bounty rewards (pre-funded by creators)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
            <p>
              <strong>Share Campaigns:</strong> 100% of share rewards (pre-funded by creators)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
            <p>
              <strong>View Earnings (Beta):</strong> $0.10 per 1,000 views (reduced during beta)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
            <p>
              <strong>Minimum Payout:</strong> {minPayoutAmount} SOL
            </p>
          </div>
        </div>
      </Card>

      {/* Payout History */}
      {payoutHistory.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Payout History</h3>
          <div className="space-y-3">
            {payoutHistory.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{Number(payout.amount).toFixed(4)} SOL</p>
                  <p className="text-xs text-muted-foreground">
                    Requested: {new Date(payout.requested_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded ${
                    payout.status === 'completed' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : payout.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                  }`}>
                    {payout.status}
                  </span>
                  {payout.transaction_signature && (
                    <p className="text-xs text-muted-foreground mt-1">
                      TX: {payout.transaction_signature.substring(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
