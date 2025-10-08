import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Play } from 'lucide-react';

interface PumpFunPlayerProps {
  pumpFunUrl: string;
  isLive?: boolean;
  showExternalLink?: boolean;
  onStreamOpened?: () => void;
}

export function PumpFunPlayer({ 
  pumpFunUrl, 
  isLive = false,
  showExternalLink = false,
  onStreamOpened
}: PumpFunPlayerProps) {
  
  const handleOpenStream = () => {
    window.open(pumpFunUrl, '_blank', 'noopener,noreferrer');
    onStreamOpened?.();
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-background via-muted/30 to-background flex flex-col items-center justify-center gap-3 sm:gap-6 p-3 sm:p-6 md:p-8">
      {/* Live Badge */}
      {isLive && (
        <div className="absolute top-3 sm:top-6 left-3 sm:left-6 z-10">
          <Badge variant="destructive" className="bg-live text-live-foreground text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2 shadow-xl">
            <span className="inline-block h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 rounded-full bg-current mr-1.5 sm:mr-2 animate-pulse" />
            LIVE NOW
          </Badge>
        </div>
      )}

      {/* External Link Button */}
      {showExternalLink && (
        <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-10">
          <Button 
            size="sm"
            variant="secondary"
            className="gap-2 shadow-lg active:scale-95 transition-transform"
            onClick={handleOpenStream}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open in new tab</span>
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col items-center gap-3 sm:gap-6 max-w-md text-center px-3">
        {/* Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative bg-primary/10 p-3 sm:p-6 rounded-full">
            <Play className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-1.5 sm:space-y-3">
          <h3 className="text-lg sm:text-2xl font-bold text-foreground">
            Watch Live on Pump.fun
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm leading-snug">
            This stream is hosted on Pump.fun's platform. Click the button below to watch the live stream in a new tab.
          </p>
        </div>

        {/* CTA Button */}
        <Button 
          size="default"
          className="gap-2 sm:gap-3 text-sm sm:text-lg px-5 py-3 sm:px-8 sm:py-6 shadow-xl active:scale-95 transition-transform w-full sm:w-auto"
          onClick={handleOpenStream}
        >
          <Play className="h-4 w-4 sm:h-5 sm:w-5" />
          Watch Live Stream
        </Button>

        {/* Helper Text */}
        <p className="text-xs text-muted-foreground/70">
          Opens in a new tab • Hosted on pump.fun
        </p>
      </div>
    </div>
  );
}
