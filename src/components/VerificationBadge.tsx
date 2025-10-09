import { CheckCircle2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VerificationBadgeProps {
  verificationType: 'blue' | 'red' | 'none' | null;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function VerificationBadge({ 
  verificationType, 
  size = 'md', 
  showTooltip = true,
  className 
}: VerificationBadgeProps) {
  if (!verificationType || verificationType === 'none') {
    return null;
  }

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const colorClasses = {
    blue: 'text-blue-500',
    red: 'text-red-500',
  };

  const tooltipText = {
    blue: 'Verified Account - Identity confirmed',
    red: 'Earned Verification - Achieved through engagement and hard work',
  };

  const badge = (
    <CheckCircle2 
      className={cn(
        sizeClasses[size], 
        colorClasses[verificationType],
        'flex-shrink-0',
        className
      )} 
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
          <p className="text-xs">{tooltipText[verificationType]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
