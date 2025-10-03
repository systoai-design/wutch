import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface WatchTimeIndicatorProps {
  watchTime: number;
  formattedWatchTime: string;
  isTabVisible: boolean;
  isPumpFunOpen: boolean;
  meetsMinimumWatchTime: boolean;
  minimumRequired?: number; // in seconds, default 300 (5 minutes)
}

const WatchTimeIndicator = ({ 
  watchTime, 
  formattedWatchTime, 
  isTabVisible,
  isPumpFunOpen, 
  meetsMinimumWatchTime,
  minimumRequired = 300 
}: WatchTimeIndicatorProps) => {
  const progressPercentage = Math.min((watchTime / minimumRequired) * 100, 100);
  const minutesRequired = Math.floor(minimumRequired / 60);
  const isTracking = isTabVisible && isPumpFunOpen;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="font-semibold">Watch Time Tracker</span>
        </div>
        <Badge 
          variant={isTracking ? "default" : "secondary"}
          className="gap-1"
        >
          {isTracking ? (
            <>
              <Eye className="h-3 w-3" />
              Tracking
            </>
          ) : !isPumpFunOpen ? (
            <>
              <EyeOff className="h-3 w-3" />
              Stream Closed
            </>
          ) : (
            <>
              <EyeOff className="h-3 w-3" />
              Tab Hidden
            </>
          )}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Required: {minutesRequired} minutes
          </span>
          <span className="font-mono font-bold text-lg">
            {formattedWatchTime}
          </span>
        </div>

        <Progress value={progressPercentage} className="h-2" />

        {meetsMinimumWatchTime ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">
              Eligible to claim bounty!
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Keep this page in focus AND Pump.fun open to earn watch time.
            {!isPumpFunOpen && " (Timer paused - stream window closed)"}
            {isPumpFunOpen && !isTabVisible && " (Timer paused - page not active)"}
          </p>
        )}
      </div>
    </Card>
  );
};

export default WatchTimeIndicator;
