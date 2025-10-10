import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [activeTab, setActiveTab] = useState(0);
  const contentScrollRef = useRef<HTMLDivElement>(null);
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

  // Intersection observer for swipe detection
  useEffect(() => {
    if (!contentScrollRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt(entry.target.getAttribute('data-tab-index') || '0');
            setActiveTab(index);
          }
        });
      },
      {
        root: contentScrollRef.current,
        threshold: 0.5,
      }
    );

    const panels = contentScrollRef.current.querySelectorAll('.tab-panel');
    panels.forEach((panel) => observer.observe(panel));

    return () => observer.disconnect();
  }, [mostEarned.length, mostDonated.length, mostRewards.length, topClaimers.length]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    if (contentScrollRef.current) {
      const targetScroll = contentScrollRef.current.clientWidth * index;
      contentScrollRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const handleRefresh = () => {
    fetchLeaderboards(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Leaderboards
          </h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 sm:h-5 w-24 sm:w-32 mb-2" />
                  <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
                </div>
                <Skeleton className="h-5 sm:h-6 w-16 sm:w-24" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          Leaderboards
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Tab Headers */}
      <div className="flex overflow-x-auto snap-x snap-mandatory lg:grid lg:grid-cols-4 mb-4 sm:mb-6 scrollbar-hide border-b">
        {[
          { icon: <TrendingUp className="h-4 w-4" />, label: 'Most Earned', index: 0 },
          { icon: <Heart className="h-4 w-4" />, label: 'Most Donated', index: 1 },
          { icon: <Gift className="h-4 w-4" />, label: 'Most Rewards', index: 2 },
          { icon: <Trophy className="h-4 w-4" />, label: 'Top Claimers', index: 3 },
        ].map((tab) => (
          <button
            key={tab.index}
            onClick={() => handleTabClick(tab.index)}
            className={`flex-shrink-0 snap-start min-w-[140px] lg:min-w-0 flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors ${
              activeTab === tab.index 
                ? 'border-b-2 border-primary text-primary font-semibold' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Swipeable Content Panels */}
      <div 
        ref={contentScrollRef}
        className="flex overflow-x-scroll snap-x snap-mandatory scroll-smooth scrollbar-hide"
      >
        {/* Tab 0: Most Earned */}
        <div className="min-w-full snap-start snap-always tab-panel" data-tab-index="0">
          <div className="space-y-3 px-1">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
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
          </div>
        </div>

        {/* Tab 1: Most Donated */}
        <div className="min-w-full snap-start snap-always tab-panel" data-tab-index="1">
          <div className="space-y-3 px-1">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
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
          </div>
        </div>

        {/* Tab 2: Most Rewards */}
        <div className="min-w-full snap-start snap-always tab-panel" data-tab-index="2">
          <div className="space-y-3 px-1">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
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
          </div>
        </div>

        {/* Tab 3: Top Claimers */}
        <div className="min-w-full snap-start snap-always tab-panel" data-tab-index="3">
          <div className="space-y-3 px-1">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}