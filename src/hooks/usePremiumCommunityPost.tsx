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
    if (!postId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      // Always call backend to check premium status, even without user
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
        // Handle 402 Payment Required (premium content without access)
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
        // Always set premium status correctly
        setHasAccess(data.hasAccess || false);
        setIsPremium(data.isPremium || false);
        setIsOwner(data.isOwner || false);
        
        if (data.isPremium && !data.hasAccess) {
          setPrice(data.price);
          setAsset(data.asset || "SOL");
          setNetwork(data.network || "solana");
        }
      }
    } catch (err: any) {
      console.error("Error checking premium access:", err);
      setError(err.message || "Failed to check access");
      // Fail secure - deny access on error for security
      setHasAccess(false);
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      // Always check premium status, even without user
      checkAccess();
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