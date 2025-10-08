import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, Heart, Gift, RefreshCw } from 'lucide-react';
import { LeaderboardCard } from '@/components/LeaderboardCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MostEarnedEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_earned: number;
  paid_out: number;
  pending: number;
  rank: number;
}

interface MostDonatedEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_received: number;
  donation_count: number;
  rank: number;
}

interface MostRewardsGivenEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_rewards_given: number;
  bounties_total: number;
  bounties_count: number;
  campaigns_total: number;
  campaigns_count: number;
  rank: number;
}

interface BountyClaimerEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_earned: number;
  claim_count: number;
}

export default function Leaderboards() {
  const [mostEarned, setMostEarned] = useState<MostEarnedEntry[]>([]);
  const [mostDonated, setMostDonated] = useState<MostDonatedEntry[]>([]);
  const [mostRewards, setMostRewards] = useState<MostRewardsGivenEntry[]>([]);
  const [topClaimers, setTopClaimers] = useState<BountyClaimerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchLeaderboards = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [earnedRes, donatedRes, rewardsRes, claimersRes] = await Promise.all([
        supabase.rpc('get_most_earned_leaderboard', { limit_count: 50 }),
        supabase.rpc('get_most_donated_leaderboard', { limit_count: 50 }),
        supabase.rpc('get_most_rewards_given_leaderboard', { limit_count: 50 }),
        supabase
          .from('bounty_claims')
          .select(`
            user_id,
            reward_amount,
            profiles!inner(username, display_name, avatar_url)
          `)
          .eq('is_correct', true)
      ]);

      if (earnedRes.error) throw earnedRes.error;
      if (donatedRes.error) throw donatedRes.error;
      if (rewardsRes.error) throw rewardsRes.error;
      if (claimersRes.error) throw claimersRes.error;

      setMostEarned(earnedRes.data || []);
      setMostDonated(donatedRes.data || []);
      setMostRewards(rewardsRes.data || []);

      // Process bounty claimers
      const claimerMap = new Map<string, BountyClaimerEntry>();
      claimersRes.data?.forEach((claim: any) => {
        const existing = claimerMap.get(claim.user_id);
        if (existing) {
          existing.total_earned += claim.reward_amount;
          existing.claim_count += 1;
        } else {
          claimerMap.set(claim.user_id, {
            user_id: claim.user_id,
            username: claim.profiles.username,
            display_name: claim.profiles.display_name,
            avatar_url: claim.profiles.avatar_url,
            total_earned: claim.reward_amount,
            claim_count: 1,
          });
        }
      });

      const sortedClaimers = Array.from(claimerMap.values())
        .sort((a, b) => b.total_earned - a.total_earned)
        .slice(0, 50);
      setTopClaimers(sortedClaimers);

    } catch (error) {
      console.error('Error fetching leaderboards:', error);
      if (!showRefreshing) {
        toast({
          title: 'Error',
          description: 'Failed to load leaderboards',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboards();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchLeaderboards(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bounty_claims' },
        () => fetchLeaderboards(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_bounties' },
        () => fetchLeaderboards(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sharing_campaigns' },
        () => fetchLeaderboards(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'donations' },
        () => fetchLeaderboards(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = () => {
    fetchLeaderboards(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboards
          </h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8 text-primary" />
          Leaderboards
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="earned" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
          <TabsTrigger value="earned" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Most Earned</span>
            <span className="sm:hidden">Earned</span>
          </TabsTrigger>
          <TabsTrigger value="donated" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Most Donated</span>
            <span className="sm:hidden">Donated</span>
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Most Rewards</span>
            <span className="sm:hidden">Rewards</span>
          </TabsTrigger>
          <TabsTrigger value="claimers" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Top Claimers</span>
            <span className="sm:hidden">Claimers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earned" className="space-y-3">
          <p className="text-muted-foreground mb-4">
            Creators who earned the most SOL from all sources (views, bounties, shares)
          </p>
          {mostEarned.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No earnings data yet</p>
            </Card>
          ) : (
            mostEarned.map((entry) => (
              <LeaderboardCard
                key={entry.user_id}
                entry={{
                  user_id: entry.user_id,
                  username: entry.username,
                  display_name: entry.display_name,
                  avatar_url: entry.avatar_url,
                  rank: entry.rank,
                  primaryValue: entry.total_earned,
                  primaryLabel: 'Total Earned',
                  secondaryText: `Paid: ${entry.paid_out.toFixed(3)} SOL • Pending: ${entry.pending.toFixed(3)} SOL`,
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="donated" className="space-y-3">
          <p className="text-muted-foreground mb-4">
            Creators who received the most donations from the community
          </p>
          {mostDonated.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No donation data yet</p>
            </Card>
          ) : (
            mostDonated.map((entry) => (
              <LeaderboardCard
                key={entry.user_id}
                entry={{
                  user_id: entry.user_id,
                  username: entry.username,
                  display_name: entry.display_name,
                  avatar_url: entry.avatar_url,
                  rank: entry.rank,
                  primaryValue: entry.total_received,
                  primaryLabel: 'Received',
                  secondaryText: `${entry.donation_count} donation${entry.donation_count !== 1 ? 's' : ''}`,
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-3">
          <p className="text-muted-foreground mb-4">
            Most generous creators distributing bounties and campaign rewards
          </p>
          {mostRewards.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No rewards data yet</p>
            </Card>
          ) : (
            mostRewards.map((entry) => (
              <LeaderboardCard
                key={entry.user_id}
                entry={{
                  user_id: entry.user_id,
                  username: entry.username,
                  display_name: entry.display_name,
                  avatar_url: entry.avatar_url,
                  rank: entry.rank,
                  primaryValue: entry.total_rewards_given,
                  primaryLabel: 'Given',
                  secondaryText: `${entry.bounties_count} bounties • ${entry.campaigns_count} campaigns`,
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="claimers" className="space-y-3">
          <p className="text-muted-foreground mb-4">
            Top bounty hunters who claimed the most rewards
          </p>
          {topClaimers.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No bounty claims yet</p>
            </Card>
          ) : (
            topClaimers.map((entry, index) => (
              <LeaderboardCard
                key={entry.user_id}
                entry={{
                  user_id: entry.user_id,
                  username: entry.username,
                  display_name: entry.display_name,
                  avatar_url: entry.avatar_url,
                  rank: index + 1,
                  primaryValue: entry.total_earned,
                  primaryLabel: 'Claimed',
                  secondaryText: `${entry.claim_count} successful claim${entry.claim_count !== 1 ? 's' : ''}`,
                }}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
