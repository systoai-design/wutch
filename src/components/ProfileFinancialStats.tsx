import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Coins, Gift, Heart, TrendingUp, RefreshCw } from 'lucide-react';
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

interface ProfileFinancialStatsProps {
  userId: string;
  isOwnProfile: boolean;
  className?: string;
}

export function ProfileFinancialStats({ userId, isOwnProfile, className = '' }: ProfileFinancialStatsProps) {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [x402Stats, setX402Stats] = useState<any>(null);
  const { toast } = useToast();

  const fetchFinancialStats = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const { data, error } = await supabase.rpc('get_user_financial_stats', {
        p_user_id: userId
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const rawData = data[0];
        setStats({
          total_earned: rawData.total_earned,
          total_rewards_given: rawData.total_rewards_given,
          total_donated: rawData.total_donated,
          total_received: rawData.total_received,
          earnings_breakdown: rawData.earnings_breakdown as any,
          rewards_breakdown: rawData.rewards_breakdown as any,
        });
        setLastUpdated(new Date());
      }
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

    // Set up real-time subscriptions for tables that affect stats
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
        () => {
          fetchFinancialStats(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_bounties',
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          fetchFinancialStats(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bounty_claims',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchFinancialStats(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_shares',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchFinancialStats(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'view_earnings',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchFinancialStats(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sharing_campaigns',
          filter: `creator_id=eq.${userId}`,
        },
        () => {
          fetchFinancialStats(true);
        }
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
    return `${amount.toFixed(3)} SOL`;
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className}`}>
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

  const statCards = [
    {
      label: 'Total Earned',
      value: stats.total_earned,
      icon: Coins,
      color: 'text-green-500',
      show: true,
      tooltip: (
        <div className="space-y-1 text-sm">
          <div className="font-semibold mb-2">Earnings Breakdown</div>
          <div>View Earnings: {formatSOL(stats.earnings_breakdown.view_earnings)}</div>
          <div>Bounty Rewards: {formatSOL(stats.earnings_breakdown.bounty_earnings)}</div>
          <div>Share Rewards: {formatSOL(stats.earnings_breakdown.share_earnings)}</div>
          <div className="border-t pt-1 mt-1">
            <div>Pending: {formatSOL(stats.earnings_breakdown.pending)}</div>
            <div>Paid Out: {formatSOL(stats.earnings_breakdown.paid_out)}</div>
          </div>
        </div>
      )
    },
    {
      label: 'Rewards Given',
      value: stats.total_rewards_given,
      icon: Gift,
      color: 'text-purple-500',
      show: true,
      tooltip: (
        <div className="space-y-1 text-sm">
          <div className="font-semibold mb-2">Rewards Breakdown</div>
          <div>Bounties Created: {stats.rewards_breakdown.bounties_created}</div>
          <div>Bounties Deposited: {formatSOL(stats.rewards_breakdown.bounties_total)}</div>
          <div>Bounties Claimed: {formatSOL(stats.rewards_breakdown.bounties_paid)}</div>
          <div className="border-t pt-1 mt-1">
            <div>Campaigns Created: {stats.rewards_breakdown.campaigns_created}</div>
            <div>Campaign Budget: {formatSOL(stats.rewards_breakdown.campaigns_total)}</div>
            <div>Campaign Spent: {formatSOL(stats.rewards_breakdown.campaigns_spent)}</div>
          </div>
        </div>
      )
    },
    {
      label: 'Donated',
      value: stats.total_donated,
      icon: Heart,
      color: 'text-red-500',
      show: isOwnProfile,
      tooltip: (
        <div className="text-sm">
          Total donations you've made to other creators
        </div>
      )
    },
    {
      label: 'Received',
      value: stats.total_received,
      icon: TrendingUp,
      color: 'text-blue-500',
      show: true,
      tooltip: (
        <div className="text-sm">
          Total donations received from supporters
        </div>
      )
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
        <div className={`grid grid-cols-2 ${isOwnProfile ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-4`}>
        {visibleCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Card className="p-3 sm:p-4 hover:scale-105 transition-transform cursor-help bg-card/50 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                    <span className="text-xs sm:text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="text-lg sm:text-2xl font-bold">
                    {formatSOL(stat.value)}
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
