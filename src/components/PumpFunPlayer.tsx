import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  useEffect(() => {
    // Extract token address from Pump.fun URL
    // Format: https://pump.fun/coin/[token-address] or https://pump.fun/[token-address]
    try {
      const url = new URL(pumpFunUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Get the last part of the path (token address)
      const tokenAddress = pathParts[pathParts.length - 1];
      
      if (tokenAddress) {
        // Use pumpembed.com for embedding
        const embedUrl = `https://pumpembed.com/${tokenAddress}`;
        setEmbedUrl(embedUrl);
        console.log('[PumpFunPlayer] Extracted embed URL:', embedUrl);
        onLoadStart?.();
      } else {
        throw new Error('Could not extract token address from URL');
      }
    } catch (error) {
      console.error('[PumpFunPlayer] Error parsing Pump.fun URL:', error);
      setHasError(true);
      onLoadError?.();
    }
  }, [pumpFunUrl, onLoadStart, onLoadError]);

  const handleIframeLoad = () => {
    console.log('[PumpFunPlayer] Iframe loaded successfully');
    setIsLoading(false);
  };

  const handleIframeError = () => {
    console.error('[PumpFunPlayer] Iframe failed to load');
    setIsLoading(false);
    setHasError(true);
    onLoadError?.();
  };

  // Fallback UI if embedding fails
  if (hasError || !embedUrl) {
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
              Unable to embed stream. Please watch directly on Pump.fun.
            </AlertDescription>
          </Alert>

          <Button 
            size="lg"
            className="gap-2 w-full"
            onClick={() => window.open(pumpFunUrl, '_blank')}
          >
            <ExternalLink className="h-5 w-5" />
            Watch Stream on Pump.fun
          </Button>
          
          <p className="text-xs text-muted-foreground font-mono opacity-50 break-all">
            {pumpFunUrl}
          </p>
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
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading stream...</p>
          </div>
        </div>
      )}

      {/* Embedded Iframe */}
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="Pump.fun Stream"
      />
    </div>
  );
}
