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
    if (!user || !contentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const { data, error: accessError } = await supabase.functions.invoke('check-premium-access', {
        body: {
          contentType,
          contentId,
        },
      });

      if (accessError) {
        // Handle 402 Payment Required
        if (accessError.message?.includes('402')) {
          setHasAccess(false);
          setIsPremium(true);
          setIsOwner(false);
          if (data) {
            setPrice(data.price);
            setAsset(data.asset);
            setNetwork(data.network);
          }
        } else {
          throw accessError;
        }
      } else if (data) {
        setHasAccess(data.hasAccess);
        setIsPremium(data.isPremium);
        setIsOwner(data.isOwner);
        if (!data.hasAccess) {
          setPrice(data.price);
          setAsset(data.asset);
          setNetwork(data.network);
        }
      }
    } catch (err: any) {
      console.error('Error checking premium access:', err);
      setError(err.message || 'Failed to check access');
      // Default to allowing access on error to avoid blocking users
      setHasAccess(true);
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
