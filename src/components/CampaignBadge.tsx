import { Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CampaignBadgeProps {
  rewardPerShare: number;
  compact?: boolean;
  className?: string;
}

export const CampaignBadge = ({ rewardPerShare, compact = false, className }: CampaignBadgeProps) => {
  return (
    <Badge 
      className={cn(
        "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold flex items-center gap-1 shadow-lg border-0",
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
        className
      )}
    >
      <Share2 className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      <span>
        {compact ? `${rewardPerShare}` : `Earn ${rewardPerShare} SOL`}
      </span>
    </Badge>
  );
};
