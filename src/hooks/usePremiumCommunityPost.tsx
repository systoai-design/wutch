import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface UsePremiumCommunityPostProps {
  postId: string;
}

interface PremiumAccessResult {
  hasAccess: boolean;
  isPremium: boolean;
  isOwner: boolean;
  price?: number;
  asset?: string;
  network?: string;
  isLoading: boolean;
  error?: string;
  checkAccess: () => Promise<void>;
}

export const usePremiumCommunityPost = ({
  postId,
}: UsePremiumCommunityPostProps): PremiumAccessResult => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [price, setPrice] = useState<number>();
  const [asset, setAsset] = useState<string>();
  const [network, setNetwork] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const checkAccess = async () => {
    if (!postId) return;

    setIsLoading(true);
    setError(undefined);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "check-premium-access",
        {
          body: {
            contentType: "community_post",
            contentId: postId,
          },
        }
      );

      if (functionError) {
        // Check if it's a 402 Payment Required (expected for premium content)
        if (functionError.message?.includes("402") || data?.isPremium) {
          setHasAccess(false);
          setIsPremium(true);
          setIsOwner(false);
          setPrice(data?.price);
          setAsset(data?.asset || "SOL");
          setNetwork(data?.network || "solana");
        } else {
          throw functionError;
        }
      } else {
        setHasAccess(data.hasAccess);
        setIsPremium(data.isPremium);
        setIsOwner(data.isOwner);
        
        if (data.isPremium && !data.hasAccess) {
          setPrice(data.price);
          setAsset(data.asset || "SOL");
          setNetwork(data.network || "solana");
        }
      }
    } catch (err: any) {
      console.error("Error checking premium access:", err);
      setError(err.message || "Failed to check access");
      // Default to allowing access on error to prevent blocking
      setHasAccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && postId) {
      checkAccess();
    } else if (postId) {
      // Not logged in, default to no access for premium
      setIsLoading(false);
    }
  }, [user, postId]);

  return {
    hasAccess,
    isPremium,
    isOwner,
    price,
    asset,
    network,
    isLoading,
    error,
    checkAccess,
  };
};