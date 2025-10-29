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
        // For 402 Payment Required, response body is in error message or context
        let errorData = null;
        
        // Try to extract JSON from error message first (format: "Edge function returned 402: Error, {json}")
        if (accessError.message && typeof accessError.message === 'string') {
          const jsonMatch = accessError.message.match(/\{[^}]+\}/);
          if (jsonMatch) {
            try {
              errorData = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.error('Failed to parse JSON from error message:', e);
            }
          }
        }
        
        // Fallback: Try to parse from context
        if (!errorData && accessError.context) {
          try {
            // Check if context is already parsed
            if (typeof accessError.context === 'object' && accessError.context.json) {
              errorData = await accessError.context.json();
            } else if (typeof accessError.context === 'object') {
              errorData = accessError.context;
            }
          } catch (parseError) {
            console.error('Failed to parse error context:', parseError);
          }
        }
        
        // Check if this is a 402-style payment-required response
        if (errorData && (errorData.isPremium !== undefined || errorData.price !== undefined)) {
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
        
        // If we get here, it's an actual error, not a payment-required response
        console.error('Non-premium access error:', accessError);
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
      // Fail secure - reset ALL premium-related state on error
      setHasAccess(false);
      setIsPremium(false);
      setIsOwner(false);
      setPrice(undefined);
      setAsset(undefined);
      setNetwork(undefined);
      setPreviewDuration(undefined);
      setCreatorWallet(null);
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
