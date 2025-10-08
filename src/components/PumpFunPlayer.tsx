import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isValidSolanaAddress } from '@/utils/urlValidation';

type ErrorType = 'service-down' | 'stream-not-broadcasting' | 'url-parsing-error' | 'unknown' | null;

interface PumpFunPlayerProps {
  pumpFunUrl: string;
  isLive: boolean;
  onLoadStart?: () => void;
  onLoadError?: () => void;
  showExternalLink?: boolean;
}

export function PumpFunPlayer({ 
  pumpFunUrl, 
  isLive, 
  onLoadStart, 
  onLoadError,
  showExternalLink = true 
}: PumpFunPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadTimeRemaining, setLoadTimeRemaining] = useState(5);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Extract and validate token address
  useEffect(() => {
    // Reset states on URL change
    setIsLoading(true);
    setHasError(false);
    setErrorType(null);
    setHasTimedOut(false);
    setLoadTimeRemaining(5);
    
    try {
      const url = new URL(pumpFunUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Get the last part of the path (token address)
      const tokenAddress = pathParts[pathParts.length - 1];
      
      if (!tokenAddress) {
        throw new Error('Could not extract token address from URL');
      }
      
      // Extract clean token address (handle malformed URLs with trailing "pump")
      const cleanTokenAddress = tokenAddress.replace(/pump$/, '');
      
      // Validate Solana address format
      if (!isValidSolanaAddress(cleanTokenAddress)) {
        console.error('[PumpFunPlayer] Invalid Solana address format:', cleanTokenAddress);
        setHasError(true);
        setErrorType('url-parsing-error');
        onLoadError?.();
        return;
      }
      
      // Use official pumpembed.com service for embedding
      const newEmbedUrl = `https://www.pumpembed.com/embed/${cleanTokenAddress}`;
      setEmbedUrl(newEmbedUrl);
      console.log('[PumpFunPlayer] Extracted embed URL:', newEmbedUrl);
      console.log('[PumpFunPlayer] Token address:', cleanTokenAddress);
      onLoadStart?.();
      
      // Start 5-second timeout
      startLoadTimeout();
      
    } catch (error) {
      console.error('[PumpFunPlayer] Error parsing Pump.fun URL:', error);
      setHasError(true);
      setErrorType('url-parsing-error');
      onLoadError?.();
    }
  }, [pumpFunUrl, onLoadStart, onLoadError, retryCount]);

  const startLoadTimeout = () => {
    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setLoadTimeRemaining(5);
    setHasTimedOut(false);
    
    // Countdown timer
    countdownRef.current = setInterval(() => {
      setLoadTimeRemaining(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Main timeout
    timeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.error('[PumpFunPlayer] Iframe load timeout after 5 seconds');
        setIsLoading(false);
        setHasTimedOut(true);
        setHasError(true);
        setErrorType('service-down');
        onLoadError?.();
      }
    }, 5000);
  };

  const handleIframeLoad = () => {
    console.log('[PumpFunPlayer] Iframe loaded successfully');
    
    // Clear timeouts on successful load
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setIsLoading(false);
    setHasTimedOut(false);
    setLoadTimeRemaining(0);
    
    // Check if iframe content loaded properly (attempt to detect 404)
    setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          // Try to detect if it's showing an error page
          // Note: This may be blocked by CORS, but we try anyway
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) {
            const bodyText = iframeDoc.body?.textContent?.toLowerCase() || '';
            if (bodyText.includes('404') || bodyText.includes('not found')) {
              console.log('[PumpFunPlayer] Detected 404 in iframe content');
              setHasError(true);
              setErrorType('stream-not-broadcasting');
              onLoadError?.();
            }
          }
        }
      } catch (e) {
        // CORS will prevent access, which is expected
        console.log('[PumpFunPlayer] Cannot check iframe content (CORS)');
      }
    }, 500);
  };

  const handleIframeError = () => {
    console.error('[PumpFunPlayer] Iframe failed to load');
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setIsLoading(false);
    setHasError(true);
    setErrorType('service-down');
    onLoadError?.();
  };

  const handleRetry = () => {
    if (retryCount < 2) {
      console.log(`[PumpFunPlayer] Retry attempt ${retryCount + 1}/2`);
      setRetryCount(prev => prev + 1);
    }
  };

  const getErrorMessage = () => {
    switch (errorType) {
      case 'service-down':
        return hasTimedOut 
          ? 'Stream is taking too long to load. The embed service may be unavailable.'
          : 'Embed service unavailable. Please watch directly on Pump.fun.';
      case 'stream-not-broadcasting':
        return 'This stream is not currently broadcasting on Pump.fun.';
      case 'url-parsing-error':
        return 'Invalid Pump.fun URL format. Please check the link.';
      default:
        return 'Unable to load stream. Please try watching directly on Pump.fun.';
    }
  };

  // Fallback UI if embedding fails
  if (hasError || !embedUrl) {
    const showRetry = retryCount < 2 && errorType !== 'url-parsing-error';
    
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center space-y-4 p-8 max-w-md">
          {isLive && (
            <Badge variant="destructive" className="bg-live text-live-foreground text-lg px-4 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-current mr-2 animate-pulse" />
              LIVE
            </Badge>
          )}
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {getErrorMessage()}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2">
            {showRetry && (
              <Button 
                size="lg"
                variant="outline"
                className="gap-2 w-full"
                onClick={handleRetry}
              >
                <RefreshCw className="h-5 w-5" />
                Retry Embed {retryCount > 0 && `(${retryCount}/2)`}
              </Button>
            )}
            
            <Button 
              size="lg"
              className="gap-2 w-full"
              onClick={() => window.open(pumpFunUrl, '_blank')}
            >
              <ExternalLink className="h-5 w-5" />
              Watch Stream on Pump.fun
            </Button>
          </div>
          
          {retryCount >= 2 && (
            <p className="text-sm text-muted-foreground">
              Having trouble loading? The stream may not be actively broadcasting.
            </p>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">Debug Info</summary>
              <div className="text-xs font-mono mt-2 p-2 bg-muted rounded space-y-1">
                <div>Error Type: {errorType || 'none'}</div>
                <div>Retry Count: {retryCount}/2</div>
                <div>Timed Out: {hasTimedOut ? 'Yes' : 'No'}</div>
                <div className="break-all">Embed URL: {embedUrl || 'none'}</div>
                <div className="break-all">Source URL: {pumpFunUrl}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Live Badge Overlay */}
      {isLive && (
        <div className="absolute top-4 left-4 z-10">
          <Badge variant="destructive" className="bg-live text-live-foreground text-sm sm:text-base px-3 py-1.5 shadow-lg">
            <span className="inline-block h-2 w-2 rounded-full bg-current mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>
      )}

      {/* External Link Button */}
      {showExternalLink && (
        <div className="absolute top-4 right-4 z-10">
          <Button 
            size="sm"
            variant="secondary"
            className="gap-2 shadow-lg"
            onClick={() => window.open(pumpFunUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open in new tab</span>
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-3">
            <Skeleton className="h-12 w-12 rounded-full mx-auto animate-pulse" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Loading stream...</p>
              {loadTimeRemaining > 0 && (
                <p className="text-xs text-muted-foreground/60">
                  ({loadTimeRemaining}s remaining)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embedded Iframe */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture; accelerometer; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="Pump.fun Stream"
        aria-label="Pump.fun live stream player"
      />
    </div>
  );
}
