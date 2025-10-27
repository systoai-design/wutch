import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Share2, Wallet, Twitter, Trash2, AlertCircle, ChevronUp } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
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
import { useIsMobile } from "@/hooks/use-mobile";

interface ShareAndEarnProps {
  contentId: string;
  contentType: 'livestream' | 'short_video' | 'wutch_video';
  contentTitle: string;
  contentUrl: string;
}

export function ShareAndEarn({ contentId, contentType, contentTitle, contentUrl }: ShareAndEarnProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [userShares, setUserShares] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [unclaimedEarnings, setUnclaimedEarnings] = useState(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { toast } = useToast();
  const { user, isGuest } = useAuth();
  const { isAdmin } = useAdmin();
  const isMobile = useIsMobile();

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
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .eq("is_active", true)
        .order('created_at', { ascending: false })
        .limit(1)
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
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .eq("is_active", true)
        .order('created_at', { ascending: false })
        .limit(1)
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
  }, [contentId, contentType, user]);

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

    const cleanHandle = twitterHandle.replace("@", "").trim();

    try {
      const { error } = await supabase
        .from("user_shares")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id,
          share_platform: "twitter",
          reward_amount: campaign.reward_per_share,
          share_url: contentUrl,
          status: "verified",
          twitter_handle: cleanHandle,
          verified_at: new Date().toISOString(),
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already Shared",
            description: "This Twitter account has already shared this campaign.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to verify your share. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Share Verified! 🎉",
          description: `You've earned ${campaign.reward_per_share} SOL!`,
        });
        
        setShowVerifyDialog(false);
        setTwitterHandle("");

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
        description: "There is no active sharing campaign",
        variant: "destructive",
      });
      return;
    }

    if (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user) {
      toast({
        title: "Share Limit Reached",
        description: `You've reached the maximum of ${campaign.max_shares_per_user} shares`,
        variant: "destructive",
      });
      return;
    }

    const shareTexts = {
      livestream: `Watch "${contentTitle}" live on Wutch! 🔴`,
      short_video: `Check out "${contentTitle}" on Wutch! 🎬`,
      wutch_video: `Watch "${contentTitle}" on Wutch! 📺`
    };

    const text = `${shareTexts[contentType]} Earn crypto while watching!`;
    const url = contentUrl;
    const hashtags = "Wutch,Web3,Crypto";

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
    
    window.open(twitterUrl, "_blank", "width=550,height=420");
    setShowVerifyDialog(true);
  };

  if (!campaign) {
    return null;
  }

  const remainingShares = campaign.max_shares_per_user ? campaign.max_shares_per_user - userShares : "Unlimited";

  // Mobile: Compact floating banner with drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerTrigger asChild>
            <div className="fixed bottom-20 left-0 right-0 z-40 mx-4 bg-gradient-to-r from-primary/90 to-primary-glow/90 backdrop-blur-md rounded-xl shadow-lg border border-primary/20 p-3 cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Share2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">Share & Earn</p>
                    <p className="text-xs text-white/80">Earn {campaign.reward_per_share} SOL per share</p>
                  </div>
                </div>
                <ChevronUp className="h-5 w-5 text-white flex-shrink-0" />
              </div>
            </div>
          </DrawerTrigger>

          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Share & Earn Campaign
              </DrawerTitle>
            </DrawerHeader>

            <div className="px-4 pb-6 space-y-4">
              {isGuest ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Reward per Share</p>
                      <p className="text-2xl font-bold">{campaign.reward_per_share} SOL</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Budget</p>
                      <p className="text-2xl font-bold">{(campaign.total_budget - campaign.spent_budget).toFixed(3)} SOL</p>
                    </div>
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Sign up to start earning rewards!
                    </AlertDescription>
                  </Alert>
                  <Button 
                    className="w-full"
                    onClick={() => window.location.href = '/?auth=signup'}
                  >
                    <Twitter className="mr-2 h-4 w-4" />
                    Sign Up to Earn
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Reward/Share</p>
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
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-2xl font-bold">{remainingShares}</p>
                    </div>
                  </div>

                  {unclaimedEarnings > 0 && (
                    <ClaimShareRewards 
                      campaignId={campaign.id}
                      unclaimedAmount={unclaimedEarnings}
                      onClaimSuccess={() => setUnclaimedEarnings(0)}
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
                      <p>Connect wallet to earn</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Verification Dialog */}
        <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Your Share</DialogTitle>
              <DialogDescription>
                Enter your Twitter/X handle to verify and earn rewards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="twitterHandle">Twitter/X Handle</Label>
                <Input
                  id="twitterHandle"
                  placeholder="@yourhandle"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyShare()}
                />
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

  // Desktop: Compact horizontal banner
  return (
    <>
      <div className="w-full bg-gradient-to-r from-primary/10 to-primary-glow/10 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Share & Earn
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete this sharing campaign.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isGuest 
                  ? `Earn ${campaign.reward_per_share} SOL per share` 
                  : `${userShares} shares • ${totalEarned.toFixed(4)} SOL earned`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!isGuest && unclaimedEarnings > 0 && (
              <ClaimShareRewards 
                campaignId={campaign.id}
                unclaimedAmount={unclaimedEarnings}
                onClaimSuccess={() => setUnclaimedEarnings(0)}
              />
            )}
            
            {isGuest ? (
              <Button onClick={() => window.location.href = '/?auth=signup'}>
                <Twitter className="mr-2 h-4 w-4" />
                Sign Up to Earn
              </Button>
            ) : (
              <Button 
                onClick={handleShare}
                disabled={!hasWallet || (campaign.max_shares_per_user && userShares >= campaign.max_shares_per_user)}
              >
                <Twitter className="mr-2 h-4 w-4" />
                Share on X
              </Button>
            )}
          </div>
        </div>

        {!isGuest && !hasWallet && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <Wallet className="h-4 w-4" />
            <p>Connect wallet to earn rewards</p>
          </div>
        )}
      </div>

      {/* Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Share</DialogTitle>
            <DialogDescription>
              Enter your Twitter/X handle to verify and earn rewards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="twitterHandle">Twitter/X Handle</Label>
              <Input
                id="twitterHandle"
                placeholder="@yourhandle"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyShare()}
              />
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
