import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Coins, TrendingUp, Video, Users, Gift, DollarSign, Eye, PlaySquare } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface EarningsData {
  bountyEarnings: number;
  livestreamDonations: number;
  shortDonations: number;
  shareEarnings: number;
  totalEarnings: number;
  totalStreamViews: number;
  totalShortViews: number;
  transactions: Array<{
    id: string;
    source: string;
    amount: number;
    date: Date;
    transaction_signature: string | null;
  }>;
}

interface ProfileAnalyticsProps {
  userId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

export const ProfileAnalytics = ({ userId }: ProfileAnalyticsProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [earningsData, setEarningsData] = useState<EarningsData>({
    bountyEarnings: 0,
    livestreamDonations: 0,
    shortDonations: 0,
    shareEarnings: 0,
    totalEarnings: 0,
    totalStreamViews: 0,
    totalShortViews: 0,
    transactions: [],
  });

  useEffect(() => {
    fetchEarningsData();
  }, [userId]);

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      // Fetch bounty claims
      const { data: bountyClaims } = await supabase
        .from('bounty_claims')
        .select('reward_amount, claimed_at, transaction_signature')
        .eq('user_id', userId)
        .eq('is_correct', true);

      // Fetch livestream donations
      const { data: livestreamDonations } = await supabase
        .from('donations')
        .select('amount, created_at, transaction_signature')
        .eq('recipient_user_id', userId)
        .eq('content_type', 'livestream')
        .eq('status', 'confirmed');

      // Fetch short video donations
      const { data: shortDonations } = await supabase
        .from('donations')
        .select('amount, created_at, transaction_signature')
        .eq('recipient_user_id', userId)
        .eq('content_type', 'shortvideo')
        .eq('status', 'confirmed');

      // Fetch share & earn rewards
      const { data: shareRewards } = await supabase
        .from('user_shares')
        .select('reward_amount, paid_at, transaction_signature')
        .eq('user_id', userId)
        .eq('status', 'paid');

      // Fetch view statistics - count views ON streams created by this user
      const { data: userStreams } = await supabase
        .from('livestreams')
        .select('id')
        .eq('user_id', userId);

      let totalStreamViews = 0;
      if (userStreams && userStreams.length > 0) {
        const streamIds = userStreams.map(s => s.id);
        const { count } = await supabase
          .from('viewing_sessions')
          .select('*', { count: 'exact', head: true })
          .in('livestream_id', streamIds);
        
        totalStreamViews = count || 0;
      }

      const { data: shortViews } = await supabase
        .from('short_videos')
        .select('view_count')
        .eq('user_id', userId);

      const totalShortViews = shortViews?.reduce((sum, video) => sum + (video.view_count || 0), 0) || 0;

      // Calculate totals
      const bountyTotal = (bountyClaims || []).reduce((sum, claim) => sum + parseFloat(String(claim.reward_amount || 0)), 0);
      const livestreamTotal = (livestreamDonations || []).reduce((sum, donation) => sum + parseFloat(String(donation.amount || 0)), 0);
      const shortTotal = (shortDonations || []).reduce((sum, donation) => sum + parseFloat(String(donation.amount || 0)), 0);
      const shareTotal = (shareRewards || []).reduce((sum, share) => sum + parseFloat(String(share.reward_amount || 0)), 0);

      // Combine all transactions
      const allTransactions = [
        ...(bountyClaims || []).map(claim => ({
          id: crypto.randomUUID(),
          source: 'Bounty Claim',
          amount: parseFloat(String(claim.reward_amount || 0)),
          date: new Date(claim.claimed_at),
          transaction_signature: claim.transaction_signature,
        })),
        ...(livestreamDonations || []).map(donation => ({
          id: crypto.randomUUID(),
          source: 'Livestream Donation',
          amount: parseFloat(String(donation.amount || 0)),
          date: new Date(donation.created_at),
          transaction_signature: donation.transaction_signature,
        })),
        ...(shortDonations || []).map(donation => ({
          id: crypto.randomUUID(),
          source: 'Short Video Donation',
          amount: parseFloat(String(donation.amount || 0)),
          date: new Date(donation.created_at),
          transaction_signature: donation.transaction_signature,
        })),
        ...(shareRewards || []).map(share => ({
          id: crypto.randomUUID(),
          source: 'Share & Earn',
          amount: parseFloat(String(share.reward_amount || 0)),
          date: new Date(share.paid_at),
          transaction_signature: share.transaction_signature,
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      setEarningsData({
        bountyEarnings: bountyTotal,
        livestreamDonations: livestreamTotal,
        shortDonations: shortTotal,
        shareEarnings: shareTotal,
        totalEarnings: bountyTotal + livestreamTotal + shortTotal + shareTotal,
        totalStreamViews,
        totalShortViews,
        transactions: allTransactions,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const pieData = [
    { name: 'Bounty Claims', value: earningsData.bountyEarnings },
    { name: 'Livestream Tips', value: earningsData.livestreamDonations },
    { name: 'Short Video Tips', value: earningsData.shortDonations },
    { name: 'Share & Earn', value: earningsData.shareEarnings },
  ].filter(item => item.value > 0);

  // Prepare line chart data (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  const lineChartData = last30Days.map(date => {
    const dayTransactions = earningsData.transactions.filter(t => 
      t.date.toDateString() === date.toDateString()
    );
    const total = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      date: format(date, 'MM/dd'),
      earnings: total,
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Earnings</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.totalEarnings.toFixed(4)} SOL</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-chart-1/10">
              <Coins className="h-5 w-5 text-chart-1" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Bounty Claims</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.bountyEarnings.toFixed(4)} SOL</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-chart-2/10">
              <TrendingUp className="h-5 w-5 text-chart-2" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Livestream Tips</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.livestreamDonations.toFixed(4)} SOL</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-chart-3/10">
              <Video className="h-5 w-5 text-chart-3" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Short Video Tips</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.shortDonations.toFixed(4)} SOL</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-chart-4/10">
              <Gift className="h-5 w-5 text-chart-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Share & Earn</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.shareEarnings.toFixed(4)} SOL</div>
        </Card>
      </div>

      {/* View Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-chart-5/10">
              <PlaySquare className="h-5 w-5 text-chart-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Stream Views</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.totalStreamViews.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Unique viewing sessions</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Short Views</span>
          </div>
          <div className="text-2xl font-bold">{earningsData.totalShortViews.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Cumulative views across all shorts</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Earnings Over Time (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
              <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Earnings by Source</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        {earningsData.transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions yet. Start earning by watching streams, claiming bounties, or receiving donations!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningsData.transactions.slice(0, 20).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.source}</TableCell>
                    <TableCell className="text-primary font-semibold">
                      {transaction.amount.toFixed(4)} SOL
                    </TableCell>
                    <TableCell>{format(transaction.date, 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>
                      {transaction.transaction_signature ? (
                        <a
                          href={`https://solscan.io/tx/${transaction.transaction_signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View on Solscan
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Coming Soon Banner */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-chart-1/10 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/20">
            <Video className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Coming Soon: Ad Revenue Sharing</h3>
            <p className="text-muted-foreground">
              We're working on YouTube-style ad revenue sharing for your short videos and livestreams. 
              Soon you'll earn based on views and engagement automatically!
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};