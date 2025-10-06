import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Wallet, Twitter, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { ClaimShareRewards } from "./ClaimShareRewards";

interface ShareAndEarnProps {
  livestreamId: string;
  streamTitle: string;
  streamUrl: string;
}

export function ShareAndEarn({ livestreamId, streamTitle, streamUrl }: ShareAndEarnProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [userShares, setUserShares] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [unclaimedEarnings, setUnclaimedEarnings] = useState(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  const handleDeleteCampaign = async () => {
    if (!campaign) return;

    const { error } = await supabase
      .from("sharing_campaigns")
      .delete()
      .eq("id", campaign.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Campaign Deleted",
        description: "The sharing campaign has been removed",
      });
      setCampaign(null);
    }
  };

  useEffect(() => {
    async function loadCampaign() {
      const { data, error } = await supabase
        .from("sharing_campaigns")
        .select("*")
        .eq("livestream_id", livestreamId)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        setCampaign(data);
      }
    }

    async function checkWallet() {
      if (!user) return;
      
      const { data } = await supabase
        .from("profile_wallets")
        .select("wallet_address")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasWallet(!!data?.wallet_address);
    }

    async function loadUserShares() {
      if (!user) return;

      const { data: activeCampaign } = await supabase
        .from("sharing_campaigns")
        .select("id")
        .eq("livestream_id", livestreamId)
        .eq("is_active", true)
        .maybeSingle();

      if (!activeCampaign) return;

      const { data: shares, error: sharesError } = await supabase
        .from("user_shares")
        .select("reward_amount, is_claimed")
        .eq("user_id", user.id)
        .eq("campaign_id", activeCampaign.id);

      if (!sharesError && shares) {
        setUserShares(shares.length);
        const total = shares.reduce((sum, share) => sum + Number(share.reward_amount), 0);
        const unclaimed = shares
          .filter(share => !share.is_claimed)
          .reduce((sum, share) => sum + Number(share.reward_amount), 0);
        setTotalEarned(total);
        setUnclaimedEarnings(unclaimed);
      }
    }

    loadCampaign();
    checkWallet();
    loadUserShares();
  }, [livestreamId, user]);

  const handleVerifyShare = async () => {
    if (!twitterHandle.trim()) {
      toast({
        title: "Twitter Handle Required",
        description: "Please enter your Twitter/X handle",
        variant: "destructive",
      });
      return;
    }

    if (!user || !campaign) return;

    setIsVerifying(true);

    // Clean the Twitter handle (remove @ if present)
    const cleanHandle = twitterHandle.replace("@", "").trim();

    try {
      const { error } = await supabase
        .from("user_shares")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id,
          share_platform: "twitter",
          reward_amount: campaign.reward_per_share,
          share_url: streamUrl,
          status: "verified",
          twitter_handle: cleanHandle,
          verified_at: new Date().toISOString(),
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already Shared",
            description: "This Twitter account has already shared this campaign. Each Twitter account can only share once.",
            variant: "destructive",
          });
        } else {
          console.error("Error recording share:", error);
          toast({
            title: "Error",
            description: "Failed to verify your share. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Share Verified! 🎉",
          description: `You've earned ${campaign.reward_per_share} SOL! You can claim your rewards anytime.`,
        });
        
        setShowVerifyDialog(false);
        setTwitterHandle("");

        // Refresh user shares
        const { data: shares } = await supabase
          .from("user_shares")
          .select("reward_amount, is_claimed")
          .eq("user_id", user.id)
          .eq("campaign_id", campaign.id);

        if (shares) {
          setUserShares(shares.length);
          const total = shares.reduce((sum, share) => sum + Number(share.reward_amount), 0);
          const unclaimed = shares
            .filter(share => !share.is_claimed)
            .reduce((sum, share) => sum + Number(share.reward_amount), 0);
          setTotalEarned(total);
          setUnclaimedEarnings(unclaimed);
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleShare = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to earn rewards for sharing",
        variant: "destructive",
      });
      return;
    }

    if (!hasWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first to receive rewards",
        variant: "destructive",
      });
      return;
    }

    if (!campaign) {
      toast({
        title: "No Active Campaign",
        description: "There is no active sharing campaign for this stream",
        variant: "destructive",
      });
      return;
    }

    if (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user) {
      toast({
        title: "Share Limit Reached",
        description: `You've reached the maximum of ${campaign.max_shares_per_user} shares for this campaign`,
        variant: "destructive",
      });
      return;
    }

    const text = `Watch "${streamTitle}" live on Wutch! 🔴 Earn crypto while watching amazing content!`;
    const url = streamUrl;
    const hashtags = "Wutch,Web3,Crypto,Livestream";

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
    
    window.open(twitterUrl, "_blank", "width=550,height=420");
    
    // Show verification dialog
    setShowVerifyDialog(true);
  };

  if (!campaign) {
    return null;
  }

  const remainingShares = campaign.max_shares_per_user ? campaign.max_shares_per_user - userShares : "Unlimited";

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share & Earn Campaign
            </CardTitle>
            <CardDescription>
              Earn {campaign.reward_per_share} SOL for each share
            </CardDescription>
          </div>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Sharing Campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this sharing campaign. Users will no longer be able to earn rewards for sharing this stream.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reward per Share</p>
              <p className="text-2xl font-bold">{campaign.reward_per_share} SOL</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your Shares</p>
              <p className="text-2xl font-bold">{userShares}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold">{totalEarned.toFixed(4)} SOL</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Remaining Shares</p>
              <p className="text-2xl font-bold">{remainingShares}</p>
            </div>
          </div>

          {unclaimedEarnings > 0 && (
            <ClaimShareRewards 
              campaignId={campaign.id}
              unclaimedAmount={unclaimedEarnings}
              onClaimSuccess={() => {
                setUnclaimedEarnings(0);
              }}
            />
          )}

          <Button 
            onClick={handleShare} 
            className="w-full"
            disabled={!hasWallet || (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user)}
          >
            <Twitter className="mr-2 h-4 w-4" />
            Share on Twitter/X
          </Button>

          {!hasWallet && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              <Wallet className="h-4 w-4" />
              <p>Connect your wallet to start earning rewards</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Share</DialogTitle>
            <DialogDescription>
              Enter your Twitter/X handle to verify your share and earn rewards. Each Twitter account can only share once per campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="twitterHandle">Twitter/X Handle</Label>
              <Input
                id="twitterHandle"
                placeholder="@yourhandle or yourhandle"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyShare()}
              />
              <p className="text-xs text-muted-foreground">
                This ensures you can only earn rewards once per campaign from each Twitter account.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)} disabled={isVerifying}>
              Cancel
            </Button>
            <Button onClick={handleVerifyShare} disabled={isVerifying || !twitterHandle.trim()}>
              {isVerifying ? "Verifying..." : "Verify & Earn"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
