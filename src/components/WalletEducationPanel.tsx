import { Card } from '@/components/ui/card';
import { Wallet, DollarSign, Trophy, Share2, Shield, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const WalletEducationPanel = () => {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Why Connect Your Wallet?</h3>
      </div>

      <p className="text-muted-foreground">
        Connecting your Solana wallet unlocks essential features and earning opportunities on Wutch.
      </p>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <DollarSign className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Receive Donations</p>
            <p className="text-sm text-muted-foreground">
              Accept SOL tips from viewers on your streams and shorts
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <DollarSign className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Send Donations</p>
            <p className="text-sm text-muted-foreground">
              Support your favorite creators with crypto tips
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Trophy className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Claim Bounties</p>
            <p className="text-sm text-muted-foreground">
              Earn rewards by participating in stream bounties and challenges
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Share2 className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Share & Earn</p>
            <p className="text-sm text-muted-foreground">
              Get paid for sharing streams through promotional campaigns
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Shield className="h-5 w-5 text-cyan-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Secure & Private</p>
            <p className="text-sm text-muted-foreground">
              Your wallet is stored securely and only visible to you
            </p>
          </div>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> Each wallet can only be connected to one Wutch account. You cannot connect a wallet that's already linked to another account.
        </AlertDescription>
      </Alert>
    </Card>
  );
};
