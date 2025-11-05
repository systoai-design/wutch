import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { CampaignAnalytics } from "@/hooks/useCampaignAnalytics";

interface CampaignPerformanceTableProps {
  campaigns: CampaignAnalytics[];
  onViewDetails?: (campaignId: string) => void;
}

export const CampaignPerformanceTable = ({ campaigns, onViewDetails }: CampaignPerformanceTableProps) => {
  const [sortField, setSortField] = useState<keyof CampaignAnalytics>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof CampaignAnalytics) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * modifier;
    }
    return String(aVal).localeCompare(String(bVal)) * modifier;
  });

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'livestream': return 'Stream';
      case 'short_video': return 'Short';
      case 'wutch_video': return 'Video';
      default: return type;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort('content_title')}
            >
              Content
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort('reward_per_share')}
            >
              Reward/Share
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort('total_shares')}
            >
              Shares
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort('unique_sharers')}
            >
              Sharers
            </TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCampaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No campaigns found
              </TableCell>
            </TableRow>
          ) : (
            sortedCampaigns.map((campaign) => {
              const budgetUsedPercent = (campaign.spent_budget / campaign.total_budget) * 100;
              return (
                <TableRow key={campaign.campaign_id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span className="truncate max-w-[200px]">{campaign.content_title}</span>
                      <Badge variant="outline" className="w-fit text-xs">
                        {getContentTypeLabel(campaign.content_type)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{campaign.reward_per_share.toFixed(4)} SOL</TableCell>
                  <TableCell>{campaign.total_shares}</TableCell>
                  <TableCell>{campaign.unique_sharers}</TableCell>
                  <TableCell>
                    <div className="space-y-1 min-w-[120px]">
                      <div className="flex justify-between text-xs">
                        <span>{campaign.spent_budget.toFixed(2)}</span>
                        <span className="text-muted-foreground">/ {campaign.total_budget.toFixed(2)}</span>
                      </div>
                      <Progress value={budgetUsedPercent} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.is_active ? "default" : "secondary"}>
                      {campaign.is_active ? "Active" : "Completed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails?.(campaign.campaign_id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
