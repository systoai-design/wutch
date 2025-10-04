import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Coins, TrendingUp, Users, Zap, Shield, Moon, Sun, Gift, Video } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BountyCard } from '@/components/BountyCard';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import wutchLogo from '@/assets/wutch-logo.png';

const Landing = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [featuredBounties, setFeaturedBounties] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoadingBounties, setIsLoadingBounties] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [stats, setStats] = useState({
    totalRewards: 0,
    activeWatchers: 0,
    liveStreams: 0
  });

  useEffect(() => {
    document.title = 'Wutch - Watch Pump.fun Streams & Earn Crypto Rewards';
    fetchFeaturedBounties();
    fetchLeaderboard();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total rewards paid
      const { data: claimsData, error: claimsError } = await supabase
        .from('bounty_claims')
        .select('reward_amount')
        .eq('is_correct', true);

      if (claimsError) throw claimsError;

      const totalRewards = (claimsData || []).reduce(
        (sum, claim) => sum + parseFloat(claim.reward_amount?.toString() || '0'),
        0
      );

      // Fetch active watchers count
      const { count: activeWatchers, error: watchersError } = await supabase
        .from('viewing_sessions')
        .select('user_id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (watchersError) throw watchersError;

      // Fetch live streams count
      const { count: liveStreams, error: streamsError } = await supabase
        .from('livestreams')
        .select('*', { count: 'exact', head: true })
        .eq('is_live', true);

      if (streamsError) throw streamsError;

      setStats({
        totalRewards,
        activeWatchers: activeWatchers || 0,
        liveStreams: liveStreams || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchFeaturedBounties = async () => {
    try {
      const { data, error } = await supabase
        .from('stream_bounties')
        .select(`
          *,
          livestream:livestreams(title, thumbnail_url),
          creator:profiles!stream_bounties_creator_id_fkey(username, display_name, avatar_url)
        `)
        .eq('is_active', true)
        .order('reward_per_participant', { ascending: false })
        .limit(3);

      if (error) throw error;
      setFeaturedBounties(data || []);
    } catch (error) {
      console.error('Error fetching bounties:', error);
    } finally {
      setIsLoadingBounties(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('bounty_claims')
        .select(`
          user_id,
          reward_amount,
          profiles!bounty_claims_user_id_fkey(username, display_name, avatar_url)
        `)
        .eq('is_correct', true);

      if (error) throw error;

      // Aggregate by user
      const userTotals = (data || []).reduce((acc: any, claim: any) => {
        if (!acc[claim.user_id]) {
          acc[claim.user_id] = {
            user_id: claim.user_id,
            total_earned: 0,
            claims_count: 0,
            profile: claim.profiles
          };
        }
        acc[claim.user_id].total_earned += parseFloat(claim.reward_amount || 0);
        acc[claim.user_id].claims_count += 1;
        return acc;
      }, {});

      const leaderboardData = Object.values(userTotals)
        .sort((a: any, b: any) => b.total_earned - a.total_earned)
        .slice(0, 10);

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md transition-all duration-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img 
              src={wutchLogo} 
              alt="Wutch" 
              className="h-10 w-10 transition-transform group-hover:scale-110"
              width="40"
              height="40"
              loading="eager"
            />
            <span className="text-2xl font-bold text-foreground">Wutch</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => document.getElementById('bounties')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Bounties
            </button>
            <button
              onClick={() => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Leaderboard
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="transition-transform hover:scale-110"
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Button asChild size="lg" className="transition-all hover:scale-105">
              <Link to="/auth">Launch App</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in">
            <Zap className="h-4 w-4" />
            Watch & Earn Crypto Rewards
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-foreground animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Watch, Create & Earn
            <span className="block text-primary mt-2">Crypto Rewards</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Whether you're watching or creating, earn real crypto rewards. Watch Pump.fun livestreams, 
            upload short videos, receive donations, and claim bounties. Your content has value.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Button asChild size="lg" className="text-lg px-8 transition-all hover:scale-105">
              <Link to="/auth">Start Earning Now</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 transition-all hover:scale-105">
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                How It Works
              </button>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="text-3xl font-bold text-primary">
                ${stats.totalRewards.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Total Rewards Paid</div>
            </div>
            <div className="text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="text-3xl font-bold text-primary">
                {stats.activeWatchers.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Active Watchers</div>
            </div>
            <div className="text-center animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="text-3xl font-bold text-primary">
                {stats.liveStreams.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Live Streams</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Multiple ways to earn crypto rewards on Wutch
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <Card className="p-8 text-center space-y-4 border-primary/20 bg-card transition-all hover:scale-105 hover:border-primary/40 hover:shadow-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <Eye className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">1. Watch Streams</h3>
              <p className="text-muted-foreground">
                Browse live streams from Pump.fun creators. Keep the page open and your watch time is tracked automatically.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-4 border-primary/20 bg-card transition-all hover:scale-105 hover:border-primary/40 hover:shadow-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">2. Meet Requirements</h3>
              <p className="text-muted-foreground">
                Accumulate watch time (minimum 5 minutes) to qualify for bounty rewards. The longer you watch, the more you can earn.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-4 border-primary/20 bg-card transition-all hover:scale-105 hover:border-primary/40 hover:shadow-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <Coins className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">3. Claim Bounties</h3>
              <p className="text-muted-foreground">
                Find secret words in streams and claim bounty rewards. Earn through donations, Share & Earn campaigns, and more.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-4 border-primary/20 bg-card transition-all hover:scale-105 hover:border-primary/40 hover:shadow-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">4. Create & Earn</h3>
              <p className="text-muted-foreground">
                Upload short videos and earn through viewer donations. Soon: YouTube-style ad revenue sharing and pay-per-view!
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Available Bounties */}
      <section id="bounties" className="py-16 md:py-20 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold mb-2 text-foreground">Available Bounties</h2>
              <p className="text-xl text-muted-foreground">
                Watch streams and claim crypto rewards
              </p>
            </div>
            <Button 
              size="lg"
              onClick={() => navigate('/bounties')}
              className="flex items-center gap-2"
            >
              Browse All Jobs
            </Button>
          </div>

          {isLoadingBounties ? (
            <div className="grid md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-accent/20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : featuredBounties.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {featuredBounties.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No active bounties at the moment. Check back soon!
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard */}
      <section id="leaderboard" className="py-16 md:py-20 bg-muted/50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Top Earners</h2>
              <p className="text-xl text-muted-foreground">
                See who's earning the most on Wutch
              </p>
            </div>

            {isLoadingLeaderboard ? (
              <div className="h-96 bg-accent/20 rounded-lg animate-pulse" />
            ) : (
              <LeaderboardTable entries={leaderboard} />
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">Why Choose Wutch?</h2>
            <p className="text-xl text-muted-foreground">
              The most rewarding way to watch live streams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Real Crypto Rewards</h3>
              <p className="text-muted-foreground">
                Earn actual crypto (SOL/USDC) paid directly to your wallet. No points, no gimmicks.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Verified Watch Time</h3>
              <p className="text-muted-foreground">
                Fair tracking system that only counts active viewing time when the page is in focus.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Stream Bounties</h3>
              <p className="text-muted-foreground">
                Creators set bounties with secret words. Be among the first to claim and earn more.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Creator Monetization</h3>
              <p className="text-muted-foreground">
                Multiple revenue streams: bounties, livestream donations, short video tips, and soon YouTube-style ad revenue.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Share & Earn</h3>
              <p className="text-muted-foreground">
                Share streams on social media and earn additional rewards through referral campaigns.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Secure & Transparent</h3>
              <p className="text-muted-foreground">
                Built on Solana blockchain with transparent reward distribution and secure wallet integration.
              </p>
            </Card>

            <Card className="p-6 space-y-3 bg-card transition-all hover:scale-105 hover:shadow-lg">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Instant Payouts</h3>
              <p className="text-muted-foreground">
                Claim your rewards and receive instant payouts through on-chain transactions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-muted/50">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of users already earning crypto rewards by watching their favorite Pump.fun streams.
            </p>
            <Button asChild size="lg" className="text-lg px-12">
              <Link to="/auth">Launch App Now</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Wutch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
