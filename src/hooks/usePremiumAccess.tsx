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
  previewDuration?: number;
  creatorWallet?: string | null;
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
  const [previewDuration, setPreviewDuration] = useState<number>();
  const [creatorWallet, setCreatorWallet] = useState<string | null>();
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
        // Supabase Functions throws FunctionsHttpError for non-2xx responses
        // For 402 Payment Required, response body is in error.context
        if (accessError.context) {
          try {
            const errorData = await accessError.context.json();
            
            // Check if this is a 402-style payment-required response
            if (errorData.isPremium !== undefined || errorData.price !== undefined) {
              // This is a 402 response with payment details
              setHasAccess(errorData.hasAccess || false);
              setIsPremium(errorData.isPremium || true);
              setIsOwner(errorData.isOwner || false);
              setPrice(errorData.price);
              setAsset(errorData.asset || 'SOL');
              setNetwork(errorData.network || 'solana');
              // Guarantee at least 3 seconds preview
              const pd = errorData.previewDuration ?? 3;
              setPreviewDuration(pd > 0 ? pd : 3);
              setCreatorWallet(errorData.creatorWallet || null);
              // Don't throw - this is expected behavior for premium content
              setIsLoading(false);
              return;
            }
          } catch (parseError) {
            console.error('Failed to parse error context:', parseError);
          }
        }
        
        // If we get here, it's an actual error, not a payment-required response
        throw accessError;
      } else if (data) {
        // Always set premium status correctly
        setHasAccess(data.hasAccess || false);
        setIsPremium(data.isPremium || false);
        setIsOwner(data.isOwner || false);
        if (data.isPremium && !data.hasAccess) {
          setPrice(data.price);
          setAsset(data.asset || 'SOL');
          setNetwork(data.network || 'solana');
          // Guarantee at least 3 seconds preview
          const pd = data.previewDuration ?? 3;
          setPreviewDuration(pd > 0 ? pd : 3);
          setCreatorWallet(data.creatorWallet || null);
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

  // Reset all state when contentId changes to prevent stale data
  useEffect(() => {
    setHasAccess(false);
    setIsPremium(false);
    setIsOwner(false);
    setPrice(undefined);
    setAsset(undefined);
    setNetwork(undefined);
    setPreviewDuration(undefined);
    setCreatorWallet(undefined);
    setError(undefined);
  }, [contentId]);

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
    previewDuration,
    creatorWallet,
    isLoading,
    error,
    checkAccess,
  };
};
