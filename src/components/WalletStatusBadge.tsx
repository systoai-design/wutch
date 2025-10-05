import { Wallet, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WalletStatusBadgeProps {
  isConnected: boolean;
  className?: string;
}

export const WalletStatusBadge = ({ isConnected, className = '' }: WalletStatusBadgeProps) => {
  if (isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1.5 ${className}`}>
              <Wallet className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Wallet Connected</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">Your Solana wallet is connected. You can receive and send donations.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className={`gap-1.5 ${className}`}>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>No Wallet Connected</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">Connect your wallet to receive donations, claim bounties, and participate in campaigns.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
