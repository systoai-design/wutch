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
import { TypewriterText } from '@/components/TypewriterText';
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
    document.title = 'Wutch - Watch & Create Content, Earn Real Crypto | View-Based Monetization';
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
      <section className="container mx-auto px-4 py-16 md:py-24 lg:py-36">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in">
            <Coins className="h-4 w-4" />
            Earn Crypto From Every View
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold leading-tight text-foreground animate-slide-up min-h-[1.2em]" style={{ animationDelay: '0.1s' }}>
            <TypewriterText className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-primary/70" />
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto animate-fade-in leading-relaxed" style={{ animationDelay: '0.2s' }}>
            Watch streams, upload shorts, go live. Earn crypto from donations, bounties, and sharing campaigns.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Button asChild size="default" className="px-6 py-2 hover:scale-105 transition-transform">
              <Link to="/auth">Start Earning Now</Link>
            </Button>
            <Button asChild size="default" variant="outline" className="px-6 py-2 hover:scale-105 transition-transform">
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                How It Works
              </button>
            </Button>
          </div>

          {/* Stats with subtle background */}
          <div className="grid grid-cols-3 gap-6 md:gap-8 pt-16 max-w-3xl mx-auto">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary">
                ${stats.totalRewards.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">Total Paid Out</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary">
                {stats.activeWatchers.toLocaleString()}+
              </div>
              <div className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">Active Earners</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary">
                {stats.liveStreams.toLocaleString()}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground mt-2 font-medium">Live Now</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gradient-to-br from-muted/30 to-muted/50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">How It Works</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Multiple ways to earn crypto on Wutch - from watching to creating
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Eye className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">1. Watch & Earn</h3>
              <p className="text-muted-foreground leading-relaxed">
                Watch livestreams and short videos. Claim bounties for active watching and participate in sharing campaigns to earn crypto rewards.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Video className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">2. Create Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                Upload short videos or go live. Receive 95% of all donations (5% platform fee) and tips from your audience. Create funded bounties and sharing campaigns to engage viewers.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Coins className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">3. Claim Bounties</h3>
              <p className="text-muted-foreground leading-relaxed">
                Watch for secret words in streams and claim bounty rewards. Accumulate watch time (minimum 5 minutes) to qualify.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">4. Cash Out</h3>
              <p className="text-muted-foreground leading-relaxed">
                Reach 1 SOL minimum and request instant payout to your wallet. Share campaigns and donations for even more earnings.
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
      <section id="features" className="py-20 md:py-28 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Why Choose Wutch?</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              The most rewarding platform to watch and create content
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Coins className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Multiple Revenue Streams</h3>
              <p className="text-muted-foreground leading-relaxed">
                Earn 95% of all donations from your audience (5% platform fee). Create pre-funded bounties and sharing campaigns to drive engagement. View earnings in beta at $0.10 CPM.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Eye className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Verified Watch Time</h3>
              <p className="text-muted-foreground leading-relaxed">
                Fair tracking system that only counts active viewing when the page is in focus. No bots, no tricks - just real engagement.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Stream Bounties</h3>
              <p className="text-muted-foreground leading-relaxed">
                Creators set bounties with secret words. Be among the first to claim and earn more on top of your view earnings.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Multiple Revenue Streams</h3>
              <p className="text-muted-foreground leading-relaxed">
                Views, donations, bounties, and share campaigns. Creators have multiple ways to monetize their content and grow income.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Share & Earn More</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share streams on social media and earn additional rewards through creator referral campaigns. More shares = more earnings.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Secure & Transparent</h3>
              <p className="text-muted-foreground leading-relaxed">
                Built on Solana blockchain with transparent reward distribution, secure wallet integration, and instant on-chain payouts.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-8 w-8 text-primary" />
              <h3 className="text-3xl md:text-4xl font-bold text-foreground">Fair & Transparent Fees</h3>
            </div>
            <div className="space-y-6 text-muted-foreground">
              <p className="text-lg">
                We believe in complete transparency. Here's exactly how our platform economics work:
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">Donations: 95% to Creators</p>
                    <p className="text-sm">You keep 95%, we take 5% to maintain the platform and cover transaction costs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">Bounties: 100% Pre-Funded</p>
                    <p className="text-sm">Creators deposit rewards in secure escrow. Users receive 100% of claimed bounties</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">Share Campaigns: 100% Pre-Funded</p>
                    <p className="text-sm">Creators deposit campaign budgets upfront. No hidden costs or deductions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-background/50 rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">View Earnings: Beta Phase</p>
                    <p className="text-sm">Currently at reduced rates ($0.10 CPM) during platform beta testing</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-10">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Ready to Start Earning?
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              Join thousands of creators and viewers already earning crypto rewards. 
              Watch streams, create content, and get paid for your time and engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-12 py-6 h-auto hover:scale-105 transition-transform">
                <Link to="/auth">Launch App Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-12 py-6 h-auto hover:scale-105 transition-transform">
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  Back to Top
                </button>
              </Button>
            </div>
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
