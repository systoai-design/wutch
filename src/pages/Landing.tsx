import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Coins, TrendingUp, Users, Zap, Shield, Moon, Sun, Gift, Video, Wallet, DollarSign, Clock, Share2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedBountySection } from '@/components/OptimizedBountySection';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { TypewriterText } from '@/components/TypewriterText';
import wutchLogo from '@/assets/wutch-logo.png';
import xLogo from '@/assets/x-logo.png';

// Memoized stat card component
const StatCard = memo(({ value, label, delay }: { value: string; label: string; delay: string }) => (
  <div className="text-center p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in" style={{ animationDelay: delay }}>
    <div className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">
      {value}
    </div>
    <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mt-1 sm:mt-2 font-medium">{label}</div>
  </div>
));

const Landing = () => {
  const { isDark, toggleTheme } = useThemeStore();
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
  const [creatorStats, setCreatorStats] = useState({
    totalPaidToCreators: 0,
    activeCreators: 0,
    averageEarnings: 0
  });
  const [sectionsVisible, setSectionsVisible] = useState({
    bounties: false,
    leaderboard: false,
    creator: false,
  });

  // Intersection Observer for lazy loading sections
  const observerRef = useRef<IntersectionObserver | null>(null);

  const observeSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element || !observerRef.current) return;
    observerRef.current.observe(element);
  }, []);

  useEffect(() => {
    document.title = 'Wutch - Earn SOLANA | 4 Ways to Get Crypto Rewards | Watch, Create, Share';
    
    // Setup Intersection Observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            if (sectionId === 'bounties' && !sectionsVisible.bounties) {
              setSectionsVisible(prev => ({ ...prev, bounties: true }));
              fetchFeaturedBounties();
            } else if (sectionId === 'leaderboard' && !sectionsVisible.leaderboard) {
              setSectionsVisible(prev => ({ ...prev, leaderboard: true }));
              fetchLeaderboard();
            } else if (sectionId === 'creator-rewards' && !sectionsVisible.creator) {
              setSectionsVisible(prev => ({ ...prev, creator: true }));
              fetchCreatorStats();
            }
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '100px' }
    );

    // Load critical data immediately
    fetchStats();
    
    // Observe sections for lazy loading
    setTimeout(() => {
      observeSection('bounties');
      observeSection('leaderboard');
      observeSection('creator-rewards');
    }, 100);

    return () => observerRef.current?.disconnect();
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
      // Use the secure public view that excludes secret_word
      const { data, error } = await supabase
        .from('public_stream_bounties')
        .select(`
          *,
          livestream:livestreams(title, thumbnail_url),
          creator:profiles(username, display_name, avatar_url)
        `)
        .eq('is_active', true)
        .order('reward_per_participant', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching bounties:', error);
        throw error;
      }
      
      console.log('Featured bounties fetched:', data?.length || 0);
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

  const fetchCreatorStats = async () => {
    try {
      // Fetch aggregated earnings stats using secure function
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_platform_earnings_stats');

      if (statsError) throw statsError;

      const totalPaidToCreators = statsData?.[0]?.total_paid_to_creators || 0;
      const activeCreators = Number(statsData?.[0]?.active_creators || 0);

      // Calculate average earnings
      const averageEarnings = activeCreators > 0 ? totalPaidToCreators / activeCreators : 0;

      setCreatorStats({
        totalPaidToCreators,
        activeCreators,
        averageEarnings
      });
    } catch (error) {
      console.error('Error fetching creator stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur-md transition-all duration-300">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group touch-manipulation">
            <img 
              src={wutchLogo} 
              alt="Wutch Logo" 
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl transition-transform group-hover:scale-110"
              width="40"
              height="40"
              fetchPriority="high"
              decoding="async"
            />
            <span className="text-xl sm:text-2xl font-bold text-white">Wutch</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => document.getElementById('share-campaigns')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Share Campaigns
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
              onClick={() => document.getElementById('creator-rewards')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Creator Rewards
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('https://x.com/wutchdotfun', '_blank')}
              aria-label="Follow us on X"
              className="transition-transform hover:scale-110 h-10 w-10 sm:h-11 sm:w-11"
            >
              <img src={xLogo} alt="X" className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="transition-transform hover:scale-110 h-10 w-10 sm:h-11 sm:w-11"
            >
              {isDark ? (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <Button asChild size="default" className="transition-all hover:scale-105 text-sm sm:text-base h-10 sm:h-11 px-4 sm:px-6 touch-manipulation">
              <Link to="/app">Launch App</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-3 sm:px-4 py-12 sm:py-16 md:py-24 lg:py-36">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium animate-fade-in">
            <Coins className="h-3 w-3 sm:h-4 sm:w-4" />
            Turn Attention Into SOL
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-bold leading-tight text-foreground animate-slide-up min-h-[1.2em]" style={{ animationDelay: '0.1s' }}>
            Earn Through <TypewriterText className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-primary/70" />
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto animate-fade-in leading-relaxed px-2" style={{ animationDelay: '0.2s' }}>
            Wutch rewards you with SOLANA for watching streams, creating content, claiming bounties, and sharing campaigns. Join the platform where everyone earns.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6 animate-fade-in px-2" style={{ animationDelay: '0.3s' }}>
            <Button asChild size="default" className="px-6 py-6 sm:py-2 hover:scale-105 transition-transform text-base touch-manipulation">
              <Link to="/app">Start Earning Now</Link>
            </Button>
            <Button asChild size="default" variant="outline" className="px-6 py-6 sm:py-2 hover:scale-105 transition-transform text-base touch-manipulation">
              <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                How It Works
              </button>
            </Button>
          </div>

          {/* Stats with subtle background */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8 pt-8 sm:pt-12 md:pt-16 max-w-3xl mx-auto px-2">
            <StatCard 
              value={`$${stats.totalRewards.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              label="Total Paid Out"
              delay="0.4s"
            />
            <StatCard 
              value={`${stats.activeWatchers.toLocaleString()}+`}
              label="Active Earners"
              delay="0.5s"
            />
            <StatCard 
              value={stats.liveStreams.toLocaleString()}
              label="Live Now"
              delay="0.6s"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gradient-to-br from-muted/30 to-muted/50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">How to Earn SOLANA on Wutch - 4 Simple Ways</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Earn cryptocurrency through watching streams, creating content, claiming bounties, and sharing campaigns. Start earning SOLANA today.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Eye className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Watch Livestreams & Earn SOLANA Rewards</h3>
              <p className="text-muted-foreground leading-relaxed">
                Watch livestreams and short videos. Claim bounties for active watching and participate in sharing campaigns to earn crypto rewards.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Video className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Create Videos & Earn 95% of Crypto Donations</h3>
              <p className="text-muted-foreground leading-relaxed">
                Upload short videos or go live. Receive 95% of all donations (5% platform fee) and tips from your audience. Create funded bounties and sharing campaigns to engage viewers.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Coins className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Claim SOLANA Bounties for Active Watching</h3>
              <p className="text-muted-foreground leading-relaxed">
                Watch for secret words in streams and claim bounty rewards. Accumulate watch time (minimum 5 minutes) to qualify.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-6 border-primary/20 bg-card/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 group-hover:rotate-6">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Instant SOL Payouts to Your Wallet</h3>
              <p className="text-muted-foreground leading-relaxed">
                Reach 1 SOL minimum and request instant payout to your wallet. Share campaigns and donations for even more earnings.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Share Campaigns Section */}
      <section id="share-campaigns" className="py-20 md:py-28 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Share2 className="h-4 w-4" />
              Viral Marketing Meets Crypto Rewards
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Share Campaigns - Earn & Advertise with SOLANA</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              The ultimate win-win: Users earn SOL for sharing content, Creators get viral reach for their streams
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* For Users */}
            <Card className="p-8 space-y-6 border-primary/20 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-6">
                  <Coins className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">For Users: Get Paid to Share</h3>
                  <p className="text-muted-foreground text-sm">Turn your social influence into SOLANA earnings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Find Active Campaigns</h4>
                    <p className="text-sm text-muted-foreground">Browse livestreams with active share campaigns and rewards you can earn</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Share on Twitter/X</h4>
                    <p className="text-sm text-muted-foreground">Click share, post to your Twitter/X account, and verify with your handle</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Claim Your SOL Rewards</h4>
                    <p className="text-sm text-muted-foreground">Instant rewards sent directly to your connected wallet after verification</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-primary/5">
                    <div className="text-xl font-bold text-primary">0.001+ SOL</div>
                    <div className="text-xs text-muted-foreground">Per Share</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-primary/5">
                    <div className="text-xl font-bold text-primary">Instant</div>
                    <div className="text-xs text-muted-foreground">Payouts</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* For Creators */}
            <Card className="p-8 space-y-6 border-primary/20 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur-sm transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-6">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">For Creators: Viral Advertising</h3>
                  <p className="text-muted-foreground text-sm">Fund campaigns and watch your reach explode</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Set Your Campaign Budget</h4>
                    <p className="text-sm text-muted-foreground">Choose total budget and reward per share (min 0.001 SOL). Your funds are held in escrow.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Users Share Your Stream</h4>
                    <p className="text-sm text-muted-foreground">Verified users share to their Twitter/X and get instant rewards from your campaign</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary font-bold text-xs">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Get Viral Reach & Views</h4>
                    <p className="text-sm text-muted-foreground">Each share brings new viewers, growing your audience organically</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-primary/5">
                    <div className="text-xl font-bold text-primary">0.1+ SOL</div>
                    <div className="text-xs text-muted-foreground">Min Budget</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-primary/5">
                    <div className="text-xl font-bold text-primary">5%</div>
                    <div className="text-xs text-muted-foreground">Platform Fee</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* How Share Campaigns Work */}
          <div className="mt-16 max-w-4xl mx-auto">
            <Card className="p-8 bg-gradient-to-br from-muted/50 to-muted/30 border-primary/10">
              <h3 className="text-2xl font-bold text-foreground mb-6 text-center">How Share Campaigns Work</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Secure Escrow</h4>
                  <p className="text-sm text-muted-foreground">Campaign funds held safely in escrow until shares are verified</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Anti-Abuse Protection</h4>
                  <p className="text-sm text-muted-foreground">Each Twitter account can only share once per campaign to prevent fraud</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Instant Payouts</h4>
                  <p className="text-sm text-muted-foreground">Users claim rewards immediately after share verification</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="gap-2 hover:scale-105 transition-transform">
              <Link to="/app">
                <Share2 className="h-5 w-5" />
                Start Earning from Shares
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Available Bounties */}
      <section id="bounties" className="py-16 md:py-20 bg-muted/50 scroll-mt-20">
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

          <OptimizedBountySection 
            bounties={featuredBounties}
            isLoading={isLoadingBounties}
          />
        </div>
      </section>

      {/* Leaderboard */}
      <section id="leaderboard" className="py-16 md:py-20 bg-muted/50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-foreground">SOLANA Leaderboard - Top Crypto Earners This Month</h2>
              <p className="text-xl text-muted-foreground">
                See who's earning the most SOLANA on Wutch
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

      {/* Creator Rewards Section */}
      <section id="creator-rewards" className="py-20 md:py-28 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Creator Earnings - 95% Revenue Split on All Donations</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Industry-leading 95% creator revenue split. Earn SOLANA through donations, bounties, sharing campaigns, and view-based monetization.
            </p>
          </div>

          {/* Hero Stats */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all hover:scale-105">
              <DollarSign className="h-12 w-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">
                ${creatorStats.totalPaidToCreators.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Total Paid to Creators</div>
            </Card>
            <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all hover:scale-105">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">
                {creatorStats.activeCreators.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Active Creators</div>
            </Card>
            <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40 transition-all hover:scale-105">
              <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">
                ${creatorStats.averageEarnings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Average Creator Earnings</div>
            </Card>
          </div>

          {/* Revenue Streams Grid */}
          <div className="max-w-6xl mx-auto mb-16">
            <h3 className="text-3xl font-bold text-center mb-10 text-foreground">Four Ways to Earn</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105 group">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                  <Gift className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold text-foreground">Donations</h4>
                <div className="text-3xl font-bold text-primary">95%</div>
                <p className="text-sm text-muted-foreground">You keep 95% of all donations from your viewers</p>
              </Card>

              <Card className="p-6 space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105 group">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                  <Coins className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold text-foreground">Bounties</h4>
                <div className="text-3xl font-bold text-primary">95%</div>
                <p className="text-sm text-muted-foreground">Create bounties with 5% platform fee. Viewers receive 100% of claimed rewards</p>
              </Card>

              <Card className="p-6 space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105 group">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold text-foreground">Share Campaigns</h4>
                <div className="text-3xl font-bold text-primary">100%</div>
                <p className="text-sm text-muted-foreground">Reward viewers for sharing. All campaign funds go to participants</p>
              </Card>

              <Card className="p-6 space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105 group">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                  <Eye className="h-7 w-7 text-primary" />
                </div>
                <h4 className="text-xl font-bold text-foreground">View Earnings</h4>
                <div className="text-2xl font-bold text-primary">$0.10 CPM</div>
                <p className="text-sm text-muted-foreground">Beta phase view earnings from every verified watch</p>
              </Card>
            </div>
          </div>

          {/* Platform Comparison */}
          <div className="max-w-4xl mx-auto mb-16">
            <h3 className="text-3xl font-bold text-center mb-10 text-foreground">Industry-Leading Creator Split</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8 space-y-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">Wutch</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground font-medium">Creator</span>
                    <span className="text-primary font-bold">95%</span>
                  </div>
                  <div className="h-8 bg-background/50 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full" style={{ width: '95%' }} />
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="text-muted-foreground">5%</span>
                  </div>
                </div>
              </Card>

              <Card className="p-8 space-y-6 bg-card border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h4 className="text-2xl font-bold text-foreground">Traditional Platforms</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground font-medium">Creator</span>
                    <span className="text-muted-foreground font-bold">50-70%</span>
                  </div>
                  <div className="h-8 bg-background/50 rounded-full overflow-hidden">
                    <div className="h-full bg-muted rounded-full" style={{ width: '60%' }} />
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="text-muted-foreground">30-50%</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Payment Timeline */}
          <div className="max-w-5xl mx-auto mb-16">
            <h3 className="text-3xl font-bold text-center mb-10 text-foreground">Fast & Simple Payouts</h3>
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="p-6 text-center space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Video className="h-8 w-8 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground">1. Create & Earn</div>
                <p className="text-sm text-muted-foreground">Stream, upload shorts, engage with your audience</p>
              </Card>

              <Card className="p-6 text-center space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground">2. Track Earnings</div>
                <p className="text-sm text-muted-foreground">Monitor your pending earnings in real-time</p>
              </Card>

              <Card className="p-6 text-center space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground">3. Request Payout</div>
                <p className="text-sm text-muted-foreground">Minimum 1 SOL, instant withdrawal request</p>
              </Card>

              <Card className="p-6 text-center space-y-4 bg-card hover:shadow-xl transition-all hover:scale-105">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <div className="text-lg font-bold text-foreground">4. Get Paid</div>
                <p className="text-sm text-muted-foreground">Receive SOL in 24-48 hours to your wallet</p>
              </Card>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center max-w-3xl mx-auto">
            <Card className="p-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
              <h3 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">Ready to Start Earning More?</h3>
              <p className="text-lg text-muted-foreground mb-8">
                Join the fairest creator platform. Keep 95% of donations, create bounties, and engage your audience like never before.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="px-8 py-6 h-auto text-lg hover:scale-105 transition-transform">
                  <Link to="/auth">Start Creating & Earning</Link>
                </Button>
                <Button 
                  asChild 
                  size="lg" 
                  variant="outline" 
                  className="px-8 py-6 h-auto text-lg hover:scale-105 transition-transform"
                >
                  <button onClick={() => document.getElementById('bounties')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    See Live Examples
                  </button>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Best Crypto Rewards Platform for Creators & Viewers</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Earn SOLANA through multiple methods. The fairest blockchain-powered content platform with transparent rewards.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Coins className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Multiple SOLANA Revenue Streams</h3>
              <p className="text-muted-foreground leading-relaxed">
                Earn 95% of all crypto donations from your audience (5% platform fee). Create pre-funded SOLANA bounties and sharing campaigns to drive engagement. View earnings in beta at $0.10 CPM.
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
              <h3 className="text-2xl font-bold text-foreground">SOLANA Stream Bounties</h3>
              <p className="text-muted-foreground leading-relaxed">
                Creators set crypto bounties with secret words. Be among the first to claim and earn SOLANA rewards on top of your view earnings.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Blockchain-Powered Creator Economy</h3>
              <p className="text-muted-foreground leading-relaxed">
                Views, crypto donations, SOLANA bounties, and share campaigns. Creators have multiple ways to monetize their content and grow blockchain income.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Share & Earn SOLANA Rewards</h3>
              <p className="text-muted-foreground leading-relaxed">
                Share streams on social media and earn additional SOLANA rewards through creator referral campaigns. More shares = more crypto earnings.
              </p>
            </Card>

            <Card className="p-8 space-y-4 bg-card transition-all hover:scale-105 hover:shadow-2xl hover:-translate-y-1 group">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center transition-transform group-hover:scale-110">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Secure Solana Blockchain Platform</h3>
              <p className="text-muted-foreground leading-relaxed">
                Built on Solana blockchain with transparent reward distribution, secure Web3 wallet integration, and instant on-chain SOLANA payouts.
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
                    <p className="font-semibold text-foreground mb-1">Bounties: 95% to Rewards Pool (5% Platform Fee)</p>
                    <p className="text-sm">Creators pay 5% fee when creating bounties. Users receive 100% of the advertised reward when claiming</p>
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
              Start Earning SOLANA Today - Join 1000+ Active Users
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              Join thousands of creators and viewers already earning SOLANA crypto rewards. 
              Watch streams, create content, claim bounties, and get paid for your time and engagement on the blockchain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-12 py-6 h-auto hover:scale-105 transition-transform">
                <Link to="/app">Launch App Now</Link>
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
      <footer className="border-t border-border py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
            {/* About Column */}
            <div>
              <h3 className="font-semibold mb-4">About</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms-of-service" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            {/* Platform Column */}
            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <Link to="/bounties" className="hover:text-foreground transition-colors">
                    Bounties
                  </Link>
                </li>
              </ul>
            </div>

            {/* Community Column */}
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link to="/app" className="hover:text-foreground transition-colors">
                    Explore Streams
                  </Link>
                </li>
                <li>
                  <Link to="/shorts" className="hover:text-foreground transition-colors">
                    Watch Shorts
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social Column */}
            <div>
              <h3 className="font-semibold mb-4">Social</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <a 
                    href="https://x.com/wutchdotfun" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors flex items-center gap-2"
                  >
                    <img src={xLogo} alt="X" className="h-4 w-4" />
                    X (Twitter)
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>wutch.fun@gmail.com</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 text-center text-muted-foreground">
            <p>&copy; 2025 Wutch. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
