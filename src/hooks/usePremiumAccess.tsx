import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UsePremiumAccessProps {
  contentType: 'livestream' | 'shortvideo' | 'wutch_video';
  contentId: string;
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

export const usePremiumAccess = ({ contentType, contentId }: UsePremiumAccessProps): PremiumAccessResult => {
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
    if (!contentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      // Always call backend to check premium status, even without user
      const { data, error: accessError } = await supabase.functions.invoke('check-premium-access', {
        body: {
          contentType,
          contentId,
        },
      });

      if (accessError) {
        // Handle 402 Payment Required (premium content without access)
        if (accessError.message?.includes('402')) {
          setHasAccess(false);
          setIsPremium(true);
          setIsOwner(false);
          if (data) {
            setPrice(data.price);
            setAsset(data.asset || 'SOL');
            setNetwork(data.network || 'solana');
          }
        } else {
          throw accessError;
        }
      } else if (data) {
        // Always set premium status correctly
        setHasAccess(data.hasAccess || false);
        setIsPremium(data.isPremium || false);
        setIsOwner(data.isOwner || false);
        if (data.isPremium && !data.hasAccess) {
          setPrice(data.price);
          setAsset(data.asset || 'SOL');
          setNetwork(data.network || 'solana');
        }
      }
    } catch (err: any) {
      console.error('Error checking premium access:', err);
      setError(err.message || 'Failed to check access');
      // Fail secure - deny access on error, but preserve premium status check
      setHasAccess(false);
      // Don't set isPremium to false on error - keep it as it was or set to true to be safe
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, [user, contentId, contentType]);

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
