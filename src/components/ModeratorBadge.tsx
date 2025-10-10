import { ShieldCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ModeratorBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function ModeratorBadge({ 
  size = 'md', 
  showTooltip = true,
  className 
}: ModeratorBadgeProps) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const badge = (
    <ShieldCheck 
      className={cn(
        sizeClasses[size], 
        'text-orange-500 flex-shrink-0',
        className
      )} 
      fill="currentColor"
    />
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Platform Moderator</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
