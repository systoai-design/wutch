import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Coins, TrendingUp, Users, Zap, Shield, Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Landing = () => {
  const [stats, setStats] = useState({
    totalRewards: 0,
    activeWatchers: 0,
    liveStreams: 0,
  });

  useEffect(() => {
    document.title = 'Wutch - Watch Pump.fun Streams & Earn Crypto Rewards';
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get total live streams
      const { count: streamsCount } = await supabase
        .from('livestreams')
        .select('*', { count: 'exact', head: true })
        .eq('is_live', true);

      // Get total unique viewers (profiles count)
      const { count: watchersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total rewards from bounties claimed
      const { data: bountyData } = await supabase
        .from('bounty_claims')
        .select('reward_amount');

      const totalRewards = bountyData?.reduce((sum, claim) => sum + (claim.reward_amount || 0), 0) || 0;

      setStats({
        totalRewards,
        activeWatchers: watchersCount || 0,
        liveStreams: streamsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">W</span>
            </div>
            <span className="text-2xl font-bold">Wutch</span>
          </div>
          <Button asChild size="lg">
            <Link to="/auth">Launch App</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 text-red-600 text-sm font-medium border border-red-200">
            <Zap className="h-4 w-4" />
            Watch & Earn Crypto Rewards
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight text-gray-900">
            Get Paid to Watch
            <span className="block bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent mt-2">
              Pump.fun Streams
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Join the revolution where your time has value. Watch live streams from Pump.fun creators, 
            earn crypto rewards, and claim bounties just for watching.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg" className="text-base sm:text-lg px-6 sm:px-8 bg-red-600 hover:bg-red-700 text-white h-12 sm:h-14 shadow-lg">
              <Link to="/auth" className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Start Earning Now
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 border-gray-300 text-gray-900 hover:bg-gray-50 h-12 sm:h-14">
              <a href="#how-it-works">How It Works</a>
            </Button>
          </div>

          {(stats.liveStreams > 0 || stats.activeWatchers > 0 || stats.totalRewards > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-12 max-w-2xl mx-auto">
              <div className="text-center bg-white p-4 rounded-lg">
                <div className="text-3xl sm:text-4xl font-bold text-red-600">
                  {stats.totalRewards > 0 ? `$${(stats.totalRewards / 1000).toFixed(1)}K+` : '$0'}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-2 font-medium">Total Rewards Paid</div>
              </div>
              <div className="text-center bg-white p-4 rounded-lg">
                <div className="text-3xl sm:text-4xl font-bold text-red-600">
                  {stats.activeWatchers > 0 ? `${Math.floor(stats.activeWatchers / 100) / 10}K+` : '0'}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-2 font-medium">Active Watchers</div>
              </div>
              <div className="text-center bg-white p-4 rounded-lg">
                <div className="text-3xl sm:text-4xl font-bold text-red-600">
                  {stats.liveStreams > 0 ? `${stats.liveStreams}+` : '0'}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-2 font-medium">Live Streams</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">How It Works</h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Three simple steps to start earning crypto rewards
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <Card className="p-6 sm:p-8 text-center space-y-4 border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <Eye className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">1. Watch Streams</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Browse live streams from Pump.fun creators. Keep the page open and your watch time is tracked automatically.
              </p>
            </Card>

            <Card className="p-6 sm:p-8 text-center space-y-4 border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">2. Meet Requirements</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Accumulate watch time (minimum 5 minutes) to qualify for bounty rewards. The longer you watch, the more you can earn.
              </p>
            </Card>

            <Card className="p-6 sm:p-8 text-center space-y-4 border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <Coins className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">3. Claim Rewards</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Submit secret words shared by streamers and claim your crypto rewards directly to your Solana wallet.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">Why Choose Wutch?</h2>
            <p className="text-lg sm:text-xl text-gray-600">
              The most rewarding way to watch live streams
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Real Crypto Rewards</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Earn actual crypto (SOL/USDC) paid directly to your wallet. No points, no gimmicks.
              </p>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Verified Watch Time</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Fair tracking system that only counts active viewing time when the page is in focus.
              </p>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Stream Bounties</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Creators set bounties with secret words. Be among the first to claim and earn more.
              </p>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Share & Earn</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Share streams on social media and earn additional rewards through referral campaigns.
              </p>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Secure & Transparent</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Built on Solana blockchain with transparent reward distribution and secure wallet integration.
              </p>
            </Card>

            <Card className="p-5 sm:p-6 space-y-3 border-gray-200 bg-white hover:shadow-md transition-shadow">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-red-50 flex items-center justify-center">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Instant Payouts</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Claim your rewards and receive instant payouts through on-chain transactions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              Ready to Start Earning?
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4">
              Join users earning crypto rewards by watching their favorite Pump.fun streams.
            </p>
            <Button asChild size="lg" className="text-base sm:text-lg px-8 sm:px-12 bg-red-600 hover:bg-red-700 text-white h-12 sm:h-14 shadow-lg">
              <Link to="/auth" className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Launch App Now
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-white">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p className="text-sm sm:text-base">&copy; 2025 Wutch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
