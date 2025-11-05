import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Users, Target } from "lucide-react";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";
import { CampaignMetricsChart } from "./CampaignMetricsChart";
import { CampaignPerformanceTable } from "./CampaignPerformanceTable";

interface CampaignAnalyticsDashboardProps {
  userId: string;
}

export const CampaignAnalyticsDashboard = ({ userId }: CampaignAnalyticsDashboardProps) => {
  const { data: campaigns, isLoading } = useCampaignAnalytics(userId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCampaigns = campaigns?.filter(c => c.is_active).length || 0;
  const totalBudget = campaigns?.reduce((acc, c) => acc + c.total_budget, 0) || 0;
  const totalRewardsDistributed = campaigns?.reduce((acc, c) => acc + c.total_rewards_paid, 0) || 0;
  const totalShares = campaigns?.reduce((acc, c) => acc + c.total_shares, 0) || 0;
  const uniqueSharers = new Set(campaigns?.flatMap(c => Array(c.unique_sharers).fill(c.campaign_id))).size;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBudget.toFixed(2)} SOL</div>
            <p className="text-xs text-muted-foreground">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rewards Distributed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRewardsDistributed.toFixed(2)} SOL</div>
            <p className="text-xs text-muted-foreground">
              {((totalRewardsDistributed / totalBudget) * 100 || 0).toFixed(1)}% of budget used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShares}</div>
            <p className="text-xs text-muted-foreground">
              {uniqueSharers} unique sharers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {campaigns && campaigns.length > 0 && (
        <CampaignMetricsChart campaigns={campaigns} />
      )}

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns && campaigns.length > 0 ? (
            <CampaignPerformanceTable campaigns={campaigns} />
          ) : (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground">
                Create your first sharing campaign to start earning engagement rewards
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
