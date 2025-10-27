import { useEffect, useState, useRef, useCallback, memo, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardStack } from '@/components/CardStack';
import { Eye, Coins, TrendingUp, Users, Zap, Shield, Moon, Sun, Gift, Video, Wallet, DollarSign, Clock, Share2, Trophy, Upload, ChevronRight, Lock, Briefcase, ShoppingCart, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { supabase } from '@/integrations/supabase/client';
import { TypewriterText } from '@/components/TypewriterText';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { scrollToSection } from '@/utils/performanceOptimization';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import wutchLogo from '@/assets/wutch-logo.png';
import xLogo from '@/assets/x-logo.png';
import pumpFunLogo from '@/assets/pumpfun-logo.png';

// Lazy load heavy components
const OptimizedBountySection = lazy(() => import('@/components/OptimizedBountySection').then(m => ({ default: m.OptimizedBountySection })));
const LeaderboardTable = lazy(() => import('@/components/LeaderboardTable').then(m => ({ default: m.LeaderboardTable })));

// Memoized stat card component with animated counter
const StatCard = memo(({ value, label, delay, isNumber = false }: { value: string | number; label: string; delay: string; isNumber?: boolean }) => (
  <div className="text-center p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in-up transition-all hover:scale-105" style={{ animationDelay: delay }}>
    <div className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">
      {isNumber ? (
        <AnimatedCounter value={typeof value === 'number' ? value : 0} prefix="$" />
      ) : (
        value
      )}
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
  const [animateRevenue, setAnimateRevenue] = useState(false);

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
            } else if (sectionId === 'revenue-split') {
              setAnimateRevenue(true);
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
      observeSection('revenue-split');
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
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-3 group touch-manipulation">
            <img 
              src={wutchLogo} 
              alt="Wutch Logo" 
              className="h-7 w-7 sm:h-10 sm:w-10 rounded-xl transition-transform group-hover:scale-110"
              width="40"
              height="40"
              fetchPriority="high"
              decoding="async"
            />
            <span className="text-lg sm:text-2xl font-bold text-white hidden xs:inline sm:inline">Wutch</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('share-campaigns')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Share Campaigns
            </button>
            <button
              onClick={() => scrollToSection('bounties')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Bounties
            </button>
            <button
              onClick={() => scrollToSection('leaderboard')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Leaderboard
            </button>
            <button
              onClick={() => scrollToSection('creator-rewards')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Creator Rewards
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </button>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('https://pump.fun/', '_blank')}
              aria-label="Visit PumpFun"
              className="transition-transform hover:scale-110 h-9 w-9 sm:h-11 sm:w-11"
            >
              <img src={pumpFunLogo} alt="PumpFun" className="h-4 w-4 sm:h-5 sm:w-5" width="20" height="20" loading="lazy" decoding="async" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('https://x.com/wutchdotfun', '_blank')}
              aria-label="Follow us on X"
              className="transition-transform hover:scale-110 h-9 w-9 sm:h-11 sm:w-11"
            >
              <img src={xLogo} alt="X" className="h-4 w-4 sm:h-5 sm:w-5" width="20" height="20" loading="lazy" decoding="async" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="transition-transform hover:scale-110 h-9 w-9 sm:h-11 sm:w-11"
            >
              {isDark ? (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
            <Button asChild size="default" className="transition-all hover:scale-105 text-sm sm:text-base h-9 sm:h-11 px-3 sm:px-6 touch-manipulation">
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

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6 animate-fade-in-up px-2" style={{ animationDelay: '0.3s' }}>
            <Button asChild size="default" className="px-6 py-6 sm:py-2 hover:scale-105 transition-all text-base touch-manipulation pulse-glow">
              <Link to="/app">🚀 Get Your First SOL</Link>
            </Button>
            <Button asChild size="default" variant="outline" className="px-6 py-6 sm:py-2 hover:scale-105 transition-all text-base touch-manipulation">
              <button onClick={() => scrollToSection('how-it-works')}>
                See How It Works
              </button>
            </Button>
          </div>

          {/* Stats with subtle background */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8 pt-8 sm:pt-12 md:pt-16 max-w-3xl mx-auto px-2">
            <StatCard 
              value={stats.totalRewards}
              label="Total Paid Out"
              delay="0.4s"
              isNumber={true}
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              Like YouTube, But You Earn Crypto
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">4 Ways to Earn SOLANA</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Just like YouTube shares ad revenue with creators - we share rewards with everyone. Start earning SOLANA in minutes.
            </p>
          </div>

          <CardStack 
            cards={[
              {
                icon: Eye,
                title: "Watch & Earn SOLANA",
                description: "Watch livestreams and short videos. Claim bounties for active watching and participate in sharing campaigns to earn crypto rewards.",
                color: "from-red-500/20 to-red-500/10"
              },
              {
                icon: Upload,
                title: "Create & Earn 95%",
                description: "Upload short videos or go live. Receive 95% of all donations (5% platform fee) and tips from your audience. Create funded bounties and sharing campaigns to engage viewers.",
                color: "from-blue-500/20 to-blue-500/10"
              },
              {
                icon: Trophy,
                title: "Claim Bounties",
                description: "Watch for secret words in streams and claim bounty rewards. Accumulate watch time (minimum 5 minutes) to qualify.",
                color: "from-purple-500/20 to-purple-500/10"
              },
              {
                icon: Share2,
                title: "Share & Get Paid",
                description: "Reach 1 SOL minimum and request instant payout to your wallet. Share campaigns and donations for even more earnings.",
                color: "from-green-500/20 to-green-500/10"
              }
            ]}
            className="max-w-7xl mx-auto"
          />
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
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Get Paid to Share Content</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              The ultimate win-win: You earn SOL for sharing, Creators get viral reach. Everyone wins.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* For Users */}
            <Card className="p-8 space-y-6 glass-card bg-gradient-to-br from-card/80 to-primary/5 transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
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
            <Card className="p-8 space-y-6 glass-card bg-gradient-to-br from-card/80 to-primary/5 transition-all hover:scale-105 hover:border-primary/40 hover:shadow-2xl group">
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
            <Button asChild size="lg" className="gap-2 hover:scale-105 transition-transform pulse-glow">
              <Link to="/app">
                <Share2 className="h-5 w-5" />
                💰 Claim Your First Share Reward
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* x402 Premium Content Protocol */}
      <section id="x402-protocol" className="py-20 md:py-28 bg-gradient-to-br from-purple-500/5 via-background to-pink-500/5 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-500 text-sm font-medium mb-6 border border-purple-500/20">
              <Lock className="h-4 w-4" />
              Revolutionary Payment Protocol
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Introducing <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">x402 Protocol</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Pay once with SOL, own forever. No subscriptions. No recurring fees. Pure ownership.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Feature 1 */}
            <Card className="p-6 glass-card bg-gradient-to-br from-card/80 to-purple-500/5 hover:scale-105 transition-all hover:border-purple-500/40">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center mb-4">
                <Wallet className="h-7 w-7 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">One-Time Payment</h3>
              <p className="text-muted-foreground">
                Pay once with Solana and get permanent access. No hidden fees, no surprise charges.
              </p>
              <div className="mt-4 text-2xl font-bold text-purple-500">0.001+ SOL</div>
            </Card>

            {/* Feature 2 */}
            <Card className="p-6 glass-card bg-gradient-to-br from-card/80 to-pink-500/5 hover:scale-105 transition-all hover:border-pink-500/40">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/10 flex items-center justify-center mb-4">
                <DollarSign className="h-7 w-7 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Creators Keep 95%</h3>
              <p className="text-muted-foreground">
                Industry-leading revenue share. Creators receive 95% of every sale, platform takes just 5%.
              </p>
              <div className="mt-4 text-2xl font-bold text-pink-500">95% / 5%</div>
            </Card>

            {/* Feature 3 */}
            <Card className="p-6 glass-card bg-gradient-to-br from-card/80 to-purple-500/5 hover:scale-105 transition-all hover:border-purple-500/40">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Blockchain Verified</h3>
              <p className="text-muted-foreground">
                Every purchase is recorded on Solana blockchain. Transparent, secure, and permanent.
              </p>
              <div className="mt-4 text-2xl font-bold text-green-500">100% Secure</div>
            </Card>
          </div>

          {/* What You Can Buy */}
          <div className="max-w-5xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-foreground">What You Can Access with x402</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 bg-gradient-to-br from-muted/50 to-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-2">Premium Content</h4>
                    <p className="text-sm text-muted-foreground">
                      Unlock exclusive livestreams, videos, and shorts. Pay once, watch forever.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-muted/50 to-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-2">Service Marketplace</h4>
                    <p className="text-sm text-muted-foreground">
                      Order graphic design, video editing, consulting, and more. Direct messaging with sellers included.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-muted/50 to-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-2">Exclusive Perks</h4>
                    <p className="text-sm text-muted-foreground">
                      Get access to private communities, early releases, and creator-exclusive content.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-muted/50 to-muted/30">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-2">Direct Communication</h4>
                    <p className="text-sm text-muted-foreground">
                      Chat directly with service sellers, get updates, and collaborate seamlessly.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              <Link to="/community">
                <ShoppingCart className="h-5 w-5" />
                Explore Service Marketplace
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-live/10 text-live text-xs font-medium mb-3">
                🔴 Live Now
              </div>
              <h2 className="text-4xl font-bold mb-2 text-foreground">Claim Live Bounties Now</h2>
              <p className="text-xl text-muted-foreground">
                Active bounties waiting to be claimed - earn SOLANA in minutes
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

          <ErrorBoundary>
            <Suspense fallback={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video rounded-xl" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            }>
              <OptimizedBountySection 
                bounties={featuredBounties}
                isLoading={isLoadingBounties}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </section>

      {/* Leaderboard */}
      <section id="leaderboard" className="py-16 md:py-20 bg-muted/50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Top Earners This Week</h2>
              <p className="text-xl text-muted-foreground">
                See who's making the most SOLANA - you could be next
              </p>
            </div>

            <ErrorBoundary>
              <Suspense fallback={
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-card">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              }>
                {isLoadingLeaderboard ? (
                  <div className="h-96 bg-accent/20 rounded-lg animate-pulse" />
                ) : (
                  <LeaderboardTable entries={leaderboard} />
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* Creator Rewards Section */}
      <section id="creator-rewards" className="py-20 md:py-28 bg-background scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Creators Earn 95% of All Tips</h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Like YouTube's revenue sharing but better. Keep 95% of everything you earn - the fairest split in crypto.
            </p>
          </div>

          {/* Hero Stats */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            <Card className="p-8 text-center glass-card bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/40 transition-all hover:scale-105 counter-animate">
              <DollarSign className="h-12 w-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">
                ${creatorStats.totalPaidToCreators.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Total Paid to Creators</div>
            </Card>
            <Card className="p-8 text-center glass-card bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/40 transition-all hover:scale-105 counter-animate" style={{ animationDelay: '0.1s' }}>
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">
                {creatorStats.activeCreators.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground font-medium">Active Creators</div>
            </Card>
            <Card className="p-8 text-center glass-card bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/40 transition-all hover:scale-105 counter-animate" style={{ animationDelay: '0.2s' }}>
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
          <div id="revenue-split" className="max-w-4xl mx-auto mb-16">
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
                    <span className={`text-primary font-bold ${animateRevenue ? 'animate-count-up' : ''}`}>95%</span>
                  </div>
                  <div className="h-8 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r from-primary to-primary/80 rounded-full ${animateRevenue ? 'animated-bar' : ''}`}
                      style={{ 
                        '--target-width': '95%',
                        width: animateRevenue ? '0%' : '95%'
                      } as React.CSSProperties}
                    />
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
                    <span className={`text-muted-foreground font-bold ${animateRevenue ? 'animate-count-up' : ''}`}>50-70%</span>
                  </div>
                  <div className="h-8 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-muted rounded-full ${animateRevenue ? 'animated-bar fast delayed' : ''}`}
                      style={{ 
                        '--target-width': '60%',
                        width: animateRevenue ? '0%' : '60%'
                      } as React.CSSProperties}
                    />
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
                <Button asChild size="lg" className="px-8 py-6 h-auto text-lg hover:scale-105 transition-transform pulse-glow">
                  <Link to="/auth">🎬 Start Creating & Earning</Link>
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
              Multiple ways to earn. Fair, transparent, instant payments. The crypto rewards platform built for everyone.
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
              Start Earning SOLANA Today
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
              Join 1000+ people already making daily SOL. Watch, create, share - get paid in crypto. Just like YouTube, but you actually earn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-12 py-6 h-auto hover:scale-105 transition-transform pulse-glow">
                <Link to="/app">🚀 Launch App & Start Earning</Link>
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
                    <img src={xLogo} alt="X" className="h-4 w-4" width="16" height="16" loading="lazy" decoding="async" />
                    X (Twitter)
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>support@wutch.fun</li>
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
