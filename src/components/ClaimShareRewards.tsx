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
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to claim rewards",
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);

    try {
      // Get user's wallet address
      const { data: walletData, error: walletError } = await supabase
        .from("profile_wallets")
        .select("wallet_address")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError || !walletData?.wallet_address) {
        throw new Error("Please connect your wallet first to claim rewards");
      }

      // Verify there are actually unclaimed shares
      const { data: shares, error: sharesError } = await supabase
        .from("user_shares")
        .select("id")
        .eq("user_id", user.id)
        .eq("campaign_id", campaignId)
        .eq("is_claimed", false)
        .eq("status", "verified");

      if (sharesError) throw sharesError;

      if (!shares || shares.length === 0) {
        toast({
          title: "No Shares Available",
          description: "You don't have any verified shares to claim yet. Try sharing the content first!",
          variant: "destructive",
        });
        setIsClaiming(false);
        return;
      }

      // Call unified payout edge function
      const { data, error } = await supabase.functions.invoke("process-unified-payout", {
        body: {
          payoutType: "share_reward",
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
      
      // Provide specific error messages
      let errorMessage = error.message || "Could not claim rewards. Please try again.";
      
      if (errorMessage.includes("wallet")) {
        errorMessage = "Please connect your wallet first to claim rewards";
      } else if (errorMessage.includes("No unclaimed shares")) {
        errorMessage = "No shares available to claim yet. Share the content to earn rewards!";
      } else if (errorMessage.includes("Insufficient escrow")) {
        errorMessage = "Platform is temporarily out of funds. Please try again later.";
      } else if (errorMessage.includes("Hourly limit")) {
        errorMessage = "You've reached your hourly claim limit. Please try again later.";
      }
      
      toast({
        title: "Claim Failed",
        description: errorMessage,
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
