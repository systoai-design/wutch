import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PublicWalletButtonProps {
  walletAddress: string | null;
  username: string;
}

export function PublicWalletButton({ walletAddress, username }: PublicWalletButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!walletAddress) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Wallet address copied to clipboard',
    });
  };

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Wallet className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send donation</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">Send SOL to @{username}</h4>
            <p className="text-sm text-muted-foreground">
              Copy the wallet address to send donations
            </p>
          </div>
          
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">
                {walletAddress}
              </code>
            </div>
          </div>

          <Button 
            onClick={handleCopy} 
            className="w-full gap-2"
            variant={copied ? "default" : "outline"}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Address
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
