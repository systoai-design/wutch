import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { CampaignAnalytics } from "@/hooks/useCampaignAnalytics";

interface CampaignMetricsChartProps {
  campaigns: CampaignAnalytics[];
}

export const CampaignMetricsChart = ({ campaigns }: CampaignMetricsChartProps) => {
  // Calculate platform distribution
  const twitterShares = campaigns.reduce((acc, c) => acc + c.twitter_shares, 0);
  const otherShares = campaigns.reduce((acc, c) => acc + c.total_shares - c.twitter_shares, 0);

  const platformData = [
    { name: 'Twitter/X', value: twitterShares, fill: 'hsl(var(--primary))' },
    { name: 'Other', value: otherShares, fill: 'hsl(var(--muted))' },
  ];

  // Campaign performance data for bar chart
  const performanceData = campaigns.slice(0, 5).map(c => ({
    name: c.content_title.length > 20 ? c.content_title.substring(0, 20) + '...' : c.content_title,
    shares: c.total_shares,
    budget: c.total_budget,
    spent: c.spent_budget,
  }));

  const chartConfig = {
    shares: {
      label: "Total Shares",
      color: "hsl(var(--primary))",
    },
    budget: {
      label: "Total Budget",
      color: "hsl(var(--muted))",
    },
    spent: {
      label: "Spent Budget",
      color: "hsl(var(--accent))",
    },
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Shares by Platform */}
      <Card>
        <CardHeader>
          <CardTitle>Shares by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campaigns Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="shares" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
