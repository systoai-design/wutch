import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Coins, TrendingUp, Users, Zap, Shield, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useThemeStore } from '@/store/themeStore';

const Landing = () => {
  const { isDark, toggleTheme } = useThemeStore();
  const [stats, setStats] = useState({
    totalRewards: 0,
    activeWatchers: 0,
    liveStreams: 0
  });

  useEffect(() => {
    document.title = 'Wutch - Watch Pump.fun Streams & Earn Crypto Rewards';
    
    const fetchStats = async () => {
      try {
        // Fetch total rewards from donations
        const { data: donationsData } = await supabase
          .from('donations')
          .select('amount')
          .eq('status', 'confirmed');
        
        const totalRewards = donationsData?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

        // Fetch active watchers
        const { count: activeWatchersCount } = await supabase
          .from('viewing_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch live streams
        const { count: liveStreamsCount } = await supabase
          .from('livestreams')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true);

        setStats({
          totalRewards: totalRewards,
          activeWatchers: activeWatchersCount || 0,
          liveStreams: liveStreamsCount || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">W</span>
            </div>
            <span className="text-2xl font-bold">Wutch</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button asChild size="lg">
              <Link to="/auth">Launch App</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Zap className="h-4 w-4" />
            Watch & Earn Crypto Rewards
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
            Get Paid to Watch
            <span className="block text-primary mt-2">Pump.fun Streams</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join the revolution where your time has value. Watch live streams from Pump.fun creators, 
            earn crypto rewards, and claim bounties just for watching.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/auth">Start Earning Now</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <a href="#how-it-works">How It Works</a>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{formatCurrency(stats.totalRewards)}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Rewards Paid</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.activeWatchers}</div>
              <div className="text-sm text-muted-foreground mt-1">Active Watchers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.liveStreams}</div>
              <div className="text-sm text-muted-foreground mt-1">Live Streams</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to start earning crypto rewards
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 text-center space-y-4 border-primary/20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Eye className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">1. Watch Streams</h3>
              <p className="text-muted-foreground">
                Browse live streams from Pump.fun creators. Keep the page open and your watch time is tracked automatically.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-4 border-primary/20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">2. Meet Requirements</h3>
              <p className="text-muted-foreground">
                Accumulate watch time (minimum 5 minutes) to qualify for bounty rewards. The longer you watch, the more you can earn.
              </p>
            </Card>

            <Card className="p-8 text-center space-y-4 border-primary/20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Coins className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">3. Claim Rewards</h3>
              <p className="text-muted-foreground">
                Submit secret words shared by streamers and claim your crypto rewards directly to your Solana wallet.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Wutch?</h2>
            <p className="text-xl text-muted-foreground">
              The most rewarding way to watch live streams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Real Crypto Rewards</h3>
              <p className="text-muted-foreground">
                Earn actual crypto (SOL/USDC) paid directly to your wallet. No points, no gimmicks.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Verified Watch Time</h3>
              <p className="text-muted-foreground">
                Fair tracking system that only counts active viewing time when the page is in focus.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Stream Bounties</h3>
              <p className="text-muted-foreground">
                Creators set bounties with secret words. Be among the first to claim and earn more.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Share & Earn</h3>
              <p className="text-muted-foreground">
                Share streams on social media and earn additional rewards through referral campaigns.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Secure & Transparent</h3>
              <p className="text-muted-foreground">
                Built on Solana blockchain with transparent reward distribution and secure wallet integration.
              </p>
            </Card>

            <Card className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Instant Payouts</h3>
              <p className="text-muted-foreground">
                Claim your rewards and receive instant payouts through on-chain transactions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold">
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
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Wutch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
