import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, ShoppingCart, Trophy, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EarningsSummary {
  total_earned: number;
  x402_purchases: { count: number; amount: number };
  share_rewards: { count: number; amount: number };
  bounty_rewards: { count: number; amount: number };
  service_purchases: { count: number; amount: number };
}

export function CreatorEarningsDashboard() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      if (!user) return;

      // Fetch from creator_earnings_summary view
      const { data, error } = await supabase
        .from('creator_earnings_summary')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching earnings:', error);
      } else if (data) {
        // Aggregate by transaction type
        const summary: EarningsSummary = {
          total_earned: 0,
          x402_purchases: { count: 0, amount: 0 },
          share_rewards: { count: 0, amount: 0 },
          bounty_rewards: { count: 0, amount: 0 },
          service_purchases: { count: 0, amount: 0 },
        };

        data.forEach((row) => {
          const confirmed = Number(row.confirmed_earned || 0);
          summary.total_earned += confirmed;

          if (row.transaction_type === 'x402_purchase') {
            summary.x402_purchases.count = row.transaction_count || 0;
            summary.x402_purchases.amount = confirmed;
          } else if (row.transaction_type === 'share_reward') {
            summary.share_rewards.count = row.transaction_count || 0;
            summary.share_rewards.amount = confirmed;
          } else if (row.transaction_type === 'bounty_reward') {
            summary.bounty_rewards.count = row.transaction_count || 0;
            summary.bounty_rewards.amount = confirmed;
          } else if (row.transaction_type === 'service_purchase') {
            summary.service_purchases.count = row.transaction_count || 0;
            summary.service_purchases.amount = confirmed;
          }
        });

        setEarnings(summary);
      }
      setIsLoading(false);
    };

    fetchEarnings();
  }, [user]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (!earnings) {
    return null;
  }

  const earningsSources = [
    {
      label: 'Premium Content',
      icon: ShoppingCart,
      count: earnings.x402_purchases.count,
      amount: earnings.x402_purchases.amount,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Viral Campaigns',
      icon: Share2,
      count: earnings.share_rewards.count,
      amount: earnings.share_rewards.amount,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Stream Challenges',
      icon: Trophy,
      count: earnings.bounty_rewards.count,
      amount: earnings.bounty_rewards.amount,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Service Sales',
      icon: DollarSign,
      count: earnings.service_purchases.count,
      amount: earnings.service_purchases.amount,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Creator Earnings</h2>
          <p className="text-sm text-muted-foreground">Your earnings breakdown from all sources</p>
        </div>

        {/* Total Earnings */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/20">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Confirmed Earnings</p>
              <p className="text-3xl font-bold">{earnings.total_earned.toFixed(4)} SOL</p>
              <p className="text-xs text-muted-foreground mt-1">Minimum payout: 0.1 SOL</p>
            </div>
          </div>
        </Card>

        {/* Earnings Sources */}
        <div className="grid gap-4 md:grid-cols-2">
          {earningsSources.map((source) => {
            const Icon = source.icon;
            return (
              <Card key={source.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${source.bgColor}`}>
                    <Icon className={`h-5 w-5 ${source.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{source.count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{source.amount.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">SOL</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Platform takes 5% fee on X402 purchases. Stream Challenges and Viral Campaigns paid 100% to you. Minimum payout: 0.1 SOL
          </p>
        </div>
      </div>
    </Card>
  );
}
