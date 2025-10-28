import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Coins, TrendingUp, CreditCard, Heart, RefreshCw, Sparkles, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FinancialStats {
  total_earned: number;
  total_rewards_given: number;
  total_donated: number;
  total_received: number;
  earnings_breakdown: {
    view_earnings: number;
    bounty_earnings: number;
    share_earnings: number;
    x402_earnings: number;
    pending: number;
    paid_out: number;
  };
  rewards_breakdown: {
    bounties_created: number;
    bounties_total: number;
    bounties_paid: number;
    campaigns_created: number;
    campaigns_total: number;
    campaigns_spent: number;
  };
}

interface X402Stats {
  total_premium_earned: number;
  premium_sales_count: number;
  total_premium_spent: number;
  premium_purchases_count: number;
  livestream_sales: number;
  livestream_sales_count: number;
  shortvideo_sales: number;
  shortvideo_sales_count: number;
  wutch_video_sales: number;
  wutch_video_sales_count: number;
  livestream_purchases: number;
  livestream_purchases_count: number;
  shortvideo_purchases: number;
  shortvideo_purchases_count: number;
  wutch_video_purchases: number;
  wutch_video_purchases_count: number;
}

interface ProfileFinancialStatsProps {
  userId: string;
  isOwnProfile: boolean;
  className?: string;
}

export function ProfileFinancialStats({ userId, isOwnProfile, className = '' }: ProfileFinancialStatsProps) {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [x402Stats, setX402Stats] = useState<X402Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { toast } = useToast();

  const fetchFinancialStats = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch main financial stats
      const { data: financialData, error: financialError } = await supabase
        .rpc('get_user_financial_stats', { p_user_id: userId })
        .single();

      if (financialError) throw financialError;

      // Fetch X402 stats
      const { data: x402Data, error: x402Error } = await supabase
        .rpc('get_user_x402_stats', { p_user_id: userId })
        .single();

      if (x402Error) {
        console.error('Error fetching X402 stats:', x402Error);
      }

      if (financialData) {
        setStats({
          total_earned: financialData.total_earned,
          total_rewards_given: financialData.total_rewards_given,
          total_donated: financialData.total_donated,
          total_received: financialData.total_received,
          earnings_breakdown: financialData.earnings_breakdown as any,
          rewards_breakdown: financialData.rewards_breakdown as any,
        });
      }

      if (x402Data) {
        setX402Stats(x402Data as X402Stats);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching financial stats:', error);
      if (!showRefreshing) {
        toast({
          title: 'Error',
          description: 'Failed to load financial statistics',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchFinancialStats();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('financial-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => fetchFinancialStats(true)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_transactions',
          filter: `seller_id=eq.${userId}`,
        },
        () => fetchFinancialStats(true)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_transactions',
          filter: `buyer_id=eq.${userId}`,
        },
        () => fetchFinancialStats(true)
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchFinancialStats(true);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, fetchFinancialStats]);

  const handleManualRefresh = () => {
    fetchFinancialStats(true);
  };

  const formatSOL = (amount: number) => {
    return `${amount.toFixed(4)} SOL`;
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  // Calculate total spent (premiums + bounties + campaigns + donations)
  const totalSpent = 
    (x402Stats?.total_premium_spent || 0) + 
    stats.total_rewards_given + 
    stats.total_donated;

  const statCards = [
    {
      label: 'Total Earned',
      value: formatSOL(stats.total_earned),
      icon: Coins,
      color: 'text-green-600',
      show: true,
      tooltip: (
        <div className="space-y-1 text-xs">
          <p className="font-semibold mb-2">Earnings Breakdown</p>
          <p>View Earnings: {formatSOL(stats.earnings_breakdown.view_earnings)}</p>
          <p>Stream Challenges: {formatSOL(stats.earnings_breakdown.bounty_earnings)}</p>
          <p>Viral Campaigns: {formatSOL(stats.earnings_breakdown.share_earnings)}</p>
          <p>Premium (X402): {formatSOL(stats.earnings_breakdown.x402_earnings || 0)}</p>
          <p className="font-bold pt-1 border-t">Pending: {formatSOL(stats.earnings_breakdown.pending)}</p>
          <p className="font-bold">Paid Out: {formatSOL(stats.earnings_breakdown.paid_out)}</p>
        </div>
      ),
    },
    {
      label: 'Premium Earned',
      value: formatSOL(x402Stats?.total_premium_earned || 0),
      icon: Sparkles,
      color: 'text-purple-600',
      show: isOwnProfile,
      tooltip: (
        <div className="space-y-1 text-xs">
          <p className="font-semibold mb-2">X402 Premium Sales</p>
          <p>Livestreams: {formatSOL(x402Stats?.livestream_sales || 0)} ({x402Stats?.livestream_sales_count || 0} sales)</p>
          <p>Short Videos: {formatSOL(x402Stats?.shortvideo_sales || 0)} ({x402Stats?.shortvideo_sales_count || 0} sales)</p>
          <p>Wutch Videos: {formatSOL(x402Stats?.wutch_video_sales || 0)} ({x402Stats?.wutch_video_sales_count || 0} sales)</p>
          <p className="font-bold pt-1 border-t">Total Sales: {x402Stats?.premium_sales_count || 0}</p>
        </div>
      ),
    },
    {
      label: 'Total Spent',
      value: formatSOL(totalSpent),
      icon: CreditCard,
      color: 'text-orange-600',
      show: isOwnProfile,
      tooltip: (
        <div className="space-y-1 text-xs">
          <p className="font-semibold mb-2">Spending Breakdown</p>
          <p>Premium Content: {formatSOL(x402Stats?.total_premium_spent || 0)}</p>
          <p>├ Livestreams: {formatSOL(x402Stats?.livestream_purchases || 0)} ({x402Stats?.livestream_purchases_count || 0})</p>
          <p>├ Shorts: {formatSOL(x402Stats?.shortvideo_purchases || 0)} ({x402Stats?.shortvideo_purchases_count || 0})</p>
          <p>└ Videos: {formatSOL(x402Stats?.wutch_video_purchases || 0)} ({x402Stats?.wutch_video_purchases_count || 0})</p>
          <p className="pt-1">Stream Challenges: {formatSOL(stats.rewards_breakdown.bounties_total)}</p>
          <p>├ Created: {stats.rewards_breakdown.bounties_created}</p>
          <p>└ Claimed: {formatSOL(stats.rewards_breakdown.bounties_paid)}</p>
          <p className="pt-1">Viral Campaigns: {formatSOL(stats.rewards_breakdown.campaigns_total)}</p>
          <p>├ Created: {stats.rewards_breakdown.campaigns_created}</p>
          <p>└ Spent: {formatSOL(stats.rewards_breakdown.campaigns_spent)}</p>
          <p className="pt-1">Donations: {formatSOL(stats.total_donated)}</p>
        </div>
      ),
    },
    {
      label: 'Received',
      value: formatSOL(stats.total_received),
      icon: Heart,
      color: 'text-red-600',
      show: true,
      tooltip: (
        <div className="text-xs">
          Total donations received from supporters
        </div>
      ),
    },
  ];

  const visibleCards = statCards.filter(card => card.show);

  const timeSinceUpdate = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
  const updateText = timeSinceUpdate < 5 ? '🔴 Live' : `Updated ${timeSinceUpdate}s ago`;

  return (
    <TooltipProvider>
      <div className={className}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{updateText}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isOwnProfile ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4`}>
        {visibleCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Card className="p-4 hover:scale-[1.02] transition-transform cursor-help bg-card/50 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                    <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {stat.value}
                  </div>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {stat.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
        </div>
      </div>
    </TooltipProvider>
  );
}
