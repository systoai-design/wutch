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
  const [tweetUrl, setTweetUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [userTwitterHandle, setUserTwitterHandle] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [creatorSocialLinks, setCreatorSocialLinks] = useState<any>(null);
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
        
        // Fetch creator's social links
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("social_links")
          .eq("id", data.creator_id)
          .single();
        
        if (creatorProfile?.social_links) {
          setCreatorSocialLinks(creatorProfile.social_links);
        }
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

  // Check if user has Twitter connected
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('social_links')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.social_links) {
            const socialLinks = data.social_links as any;
            if (socialLinks.twitter) {
              // Extract handle from URL like "https://twitter.com/tradesblessings" or "https://x.com/tradesblessings"
              const match = socialLinks.twitter.match(/(?:twitter|x)\.com\/([^/?]+)/i);
              if (match) {
                setUserTwitterHandle(match[1].toLowerCase());
              }
            }
          }
        });
    }
  }, [user]);

  // Extract tweet data from URL with resilient parsing
  const extractTweetData = (url: string): { tweetId: string; username: string } | null => {
    try {
      // Sanitize: trim whitespace and strip trailing punctuation like :,.;)]
      const sanitized = url.trim().replace(/[\s:;.,)\]]+$/, '');
      
      // Match patterns like:
      // https://x.com/username/status/1986153595214176766
      // https://twitter.com/username/status/1986153595214176766
      // https://mobile.x.com/username/status/1986153595214176766
      // Support query params and trailing slashes
      const regex = /(?:^https?:\/\/)?(?:[a-z]+\.)?(?:twitter|x)\.com\/([^\/\s?#]+)\/status\/(\d{10,25})/i;
      const match = sanitized.match(regex);
      
      if (!match) return null;
      
      return {
        username: match[1].toLowerCase(),
        tweetId: match[2]
      };
    } catch (error) {
      return null;
    }
  };

  const handleVerifyShare = async () => {
    // Validation checks
    if (!tweetUrl.trim()) {
      toast({
        title: "Tweet URL Required",
        description: "Please paste the URL of your shared tweet",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Please Sign In",
        description: "You need to be signed in to verify shares",
        variant: "destructive",
      });
      return;
    }

    // Check if user has Twitter connected
    if (!userTwitterHandle) {
      toast({
        title: "Twitter Not Connected",
        description: "Please connect your Twitter account in your profile settings first",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Pre-flight check: Verify campaign is still active
      const { data: currentCampaign } = await supabase
        .from("sharing_campaigns")
        .select("*")
        .eq("id", campaign.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!currentCampaign) {
        toast({
          title: "Campaign Ended",
          description: "This sharing campaign is no longer active",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Check if budget is sufficient
      if (currentCampaign.spent_budget + currentCampaign.reward_per_share > currentCampaign.total_budget) {
        toast({
          title: "Campaign Budget Exhausted",
          description: "This campaign has run out of budget",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Sanitize URL before parsing
      const sanitizedUrl = tweetUrl.trim().replace(/[\s:;.,)\]]+$/, '');
      
      // Extract tweet data from URL
      const tweetData = extractTweetData(sanitizedUrl);
      
      if (!tweetData) {
        toast({
          title: "Invalid URL",
          description: "Please provide a valid Twitter/X post URL (e.g., https://x.com/username/status/1234567890123456789)",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Verify the username matches the connected account
      if (tweetData.username !== userTwitterHandle) {
        toast({
          title: "Username Mismatch",
          description: `The tweet is from @${tweetData.username} but your connected account is @${userTwitterHandle}`,
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }

      // Insert share record with tweet ID
      const { error } = await supabase
        .from("user_shares")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id,
          share_platform: "twitter",
          reward_amount: campaign.reward_per_share,
          share_url: sanitizedUrl,
          tweet_id: tweetData.tweetId,
          status: "verified",
          twitter_handle: userTwitterHandle,
          verified_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Share verification error:", error);
        
        // Provide clear, specific error messages
        if (error.code === "23505") {
          // Unique constraint violation
          if (error.message.includes("tweet_id") || error.message.includes("idx_user_shares_campaign_tweet")) {
            toast({
              title: "Tweet Already Used",
              description: "This tweet ID has already been used for this campaign. Please share again with a new post.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Already Shared",
              description: "You have already verified a share for this campaign with this Twitter account.",
              variant: "destructive",
            });
          }
        } else if (error.message.includes("row-level security") || error.code === "42501") {
          toast({
            title: "Authentication Error",
            description: "Please sign in again and retry",
            variant: "destructive",
          });
        } else if (error.message.toLowerCase().includes("budget") || error.message.toLowerCase().includes("insufficient")) {
          toast({
            title: "Campaign Budget Exhausted",
            description: "This campaign ran out of budget",
            variant: "destructive",
          });
        } else if (error.message.toLowerCase().includes("max") || error.message.toLowerCase().includes("limit")) {
          toast({
            title: "Share Limit Reached",
            description: "You've reached the maximum shares for this campaign",
            variant: "destructive",
          });
        } else {
          // Generic fallback
          toast({
            title: "Verification Failed",
            description: "Failed to verify your share. Please try again or contact support.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Share Verified! 🎉",
          description: `You've earned ${campaign.reward_per_share} SOL!`,
        });
        
        setShowVerifyDialog(false);
        setTweetUrl("");

        // Refresh user shares data
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

    // Extract Twitter handle from social links
    let twitterHandleText = '';
    if (creatorSocialLinks?.twitter) {
      const match = creatorSocialLinks.twitter.match(/twitter\.com\/([^/?]+)/i) || 
                    creatorSocialLinks.twitter.match(/x\.com\/([^/?]+)/i);
      if (match) {
        twitterHandleText = match[1];
      }
    }

    const shareTexts = {
      livestream: `Watch "${contentTitle}" live on Wutch! 🔴`,
      short_video: `Check out "${contentTitle}" on Wutch! 🎬`,
      wutch_video: `Watch "${contentTitle}" on Wutch! 📺`
    };

    let text = `${shareTexts[contentType]} Earn crypto while watching!`;
    
    // Add creator social links to the share
    if (twitterHandleText) {
      text += `\n\nFollow the creator: @${twitterHandleText}`;
    }
    if (creatorSocialLinks?.website) {
      text += `\n🌐 ${creatorSocialLinks.website}`;
    }
    
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
                Paste the URL of your Twitter/X post to verify and earn rewards.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Show connection status */}
              {userTwitterHandle ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-green-500">✓</span>
                  Connected as @{userTwitterHandle}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No Twitter account connected. Please add your Twitter in profile settings.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="tweet-url">Twitter/X Post URL</Label>
                <Input
                  id="tweet-url"
                  placeholder="https://x.com/username/status/1234567890"
                  value={tweetUrl}
                  onChange={(e) => setTweetUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyShare()}
                  disabled={isVerifying || !userTwitterHandle}
                />
                <p className="text-xs text-muted-foreground">
                  Example: https://x.com/username/status/1234567890123456789
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowVerifyDialog(false);
                  setTweetUrl("");
                }}
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyShare}
                disabled={isVerifying || !userTwitterHandle || !tweetUrl.trim()}
              >
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Share</DialogTitle>
            <DialogDescription>
              Paste the URL of your Twitter/X post to verify and earn rewards.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Show connection status */}
            {userTwitterHandle ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-green-500">✓</span>
                Connected as @{userTwitterHandle}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No Twitter account connected. Please add your Twitter in profile settings.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="tweet-url-desktop">Twitter/X Post URL</Label>
              <Input
                id="tweet-url-desktop"
                placeholder="https://x.com/username/status/1234567890"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyShare()}
                disabled={isVerifying || !userTwitterHandle}
              />
              <p className="text-xs text-muted-foreground">
                Example: https://x.com/username/status/1234567890123456789
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowVerifyDialog(false);
                setTweetUrl("");
              }}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyShare}
              disabled={isVerifying || !userTwitterHandle || !tweetUrl.trim()}
            >
              {isVerifying ? "Verifying..." : "Verify & Earn"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
