import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Coins, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ClaimShareRewardsProps {
  campaignId: string;
  unclaimedAmount: number;
  onClaimSuccess: () => void;
}

export function ClaimShareRewards({ campaignId, unclaimedAmount, onClaimSuccess }: ClaimShareRewardsProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClaim = async () => {
    if (!user) return;

    setIsClaiming(true);

    try {
      // Get user's wallet address
      const { data: walletData, error: walletError } = await supabase
        .from("profile_wallets")
        .select("wallet_address")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError || !walletData?.wallet_address) {
        throw new Error("Please connect your wallet first");
      }

      // Call edge function to process payout
      const { data, error } = await supabase.functions.invoke("process-share-payout", {
        body: {
          userId: user.id,
          campaignId: campaignId,
          walletAddress: walletData.wallet_address,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Rewards Claimed! 🎉",
          description: `${data.totalPaid.toFixed(4)} SOL has been sent to your wallet`,
        });
        onClaimSuccess();
      } else {
        throw new Error(data.error || "Failed to process claim");
      }
    } catch (error: any) {
      console.error("Error claiming rewards:", error);
      toast({
        title: "Claim Failed",
        description: error.message || "Could not claim rewards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Unclaimed Rewards</p>
            <p className="text-2xl font-bold text-primary">{unclaimedAmount.toFixed(4)} SOL</p>
          </div>
        </div>
        <Button 
          onClick={handleClaim} 
          disabled={isClaiming || unclaimedAmount === 0}
          size="lg"
        >
          {isClaiming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : (
            "Claim Rewards"
          )}
        </Button>
      </div>
    </Card>
  );
}
