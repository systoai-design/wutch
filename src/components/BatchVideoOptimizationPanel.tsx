import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Clock, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import { useBatchVideoOptimization } from '@/hooks/useBatchVideoOptimization';

export const BatchVideoOptimizationPanel = () => {
  const {
    isRunning,
    stats,
    currentVideo,
    progress,
    fetchStats,
    populateQueue,
    startBatchOptimization,
    stopBatchOptimization
  } = useBatchVideoOptimization();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePopulateQueue = async () => {
    await populateQueue();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Batch Video Optimization</CardTitle>
        <CardDescription>
          Optimize all existing videos to improve loading speed and reduce storage costs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Pending</span>
              </div>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm">Processing</span>
              </div>
              <p className="text-2xl font-bold">{stats.processing}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Completed</span>
              </div>
              <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm">Failed</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Total Saved</div>
              <p className="text-2xl font-bold text-primary">
                {formatBytes(stats.totalSavings)}
              </p>
            </div>
          </div>
        )}

        {/* Current Video Progress */}
        {isRunning && currentVideo && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Currently optimizing:</span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(currentVideo.current_size)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{currentVideo.title}</p>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-right text-muted-foreground">{progress}%</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {!isRunning && stats?.pending === 0 && (
            <Button onClick={handlePopulateQueue} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Scan for Unoptimized Videos
            </Button>
          )}

          {!isRunning && stats && stats.pending > 0 && (
            <Button onClick={startBatchOptimization} size="lg">
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Batch Optimization ({stats.pending} videos)
            </Button>
          )}

          {isRunning && (
            <Button onClick={stopBatchOptimization} variant="destructive" size="lg">
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Optimization
            </Button>
          )}

          <Button onClick={fetchStats} variant="ghost" disabled={isRunning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Stats
          </Button>
        </div>

        {/* Info */}
        <div className="text-sm text-muted-foreground space-y-2 p-4 border rounded-lg bg-muted/30">
          <p className="font-medium">How it works:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Videos are processed one at a time in your browser</li>
            <li>Each video is optimized with fast-start metadata and compression</li>
            <li>Original videos are replaced with optimized versions</li>
            <li>You can stop and resume at any time</li>
            <li>Popular videos are prioritized automatically</li>
          </ul>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
            ⚠️ Keep this page open while optimization is running. Average time: 5-10 minutes per video.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
