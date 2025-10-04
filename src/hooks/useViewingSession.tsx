import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UseViewingSessionProps {
  livestreamId: string;
  shouldStart?: boolean;
  externalWindow?: Window | null;
  onTimerStart?: () => void;
}

export const useViewingSession = ({ livestreamId, shouldStart = false, externalWindow, onTimerStart }: UseViewingSessionProps) => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchTime, setWatchTime] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isExternalWindowOpen, setIsExternalWindowOpen] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedTimeRef = useRef<number>(0);

  // Poll external window to check if it's still open
  useEffect(() => {
    if (!externalWindow) {
      setIsExternalWindowOpen(false);
      return;
    }

    // Set to true immediately when window exists
    setIsExternalWindowOpen(true);

    const checkInterval = setInterval(() => {
      try {
        // Check if window is closed - this will be true even across origins
        if (externalWindow.closed) {
          setIsExternalWindowOpen(false);
          // Window closed - accumulate current session time
          const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
          accumulatedTimeRef.current += currentSessionTime;
          console.log('External window closed, pausing timer');
        }
      } catch (error) {
        // If we get an error checking the window, it's likely closed
        console.log('Error checking window status, assuming closed');
        setIsExternalWindowOpen(false);
      }
    }, 1000); // Check every second for more responsive detection

    return () => clearInterval(checkInterval);
  }, [externalWindow]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsTabVisible(visible);

      if (!visible) {
        // Tab hidden - accumulate current session time
        const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        accumulatedTimeRef.current += currentSessionTime;
      } else {
        // Tab visible again - reset start time
        startTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Create or resume viewing session
  useEffect(() => {
    if (!user || !livestreamId || !shouldStart) return;
    if (isSessionStarted) return; // Prevent duplicate initialization

    const initSession = async () => {
      try {
        // Look for most recent session within last 2 hours (regardless of is_active status)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        
        const { data: existingSessions } = await supabase
          .from('viewing_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('livestream_id', livestreamId)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingSessions && existingSessions.length > 0) {
          // Resume and reactivate existing session
          const session = existingSessions[0];
          
          // Reactivate the session
          await supabase
            .from('viewing_sessions')
            .update({ 
              is_active: true, 
              last_active_at: new Date().toISOString(),
              tab_visible: true
            })
            .eq('id', session.id);
          
          setSessionId(session.id);
          setWatchTime(session.total_watch_time);
          accumulatedTimeRef.current = session.total_watch_time;
          console.log('Resumed session with', session.total_watch_time, 'seconds of watch time');
        } else {
          // Create new session only if no recent session exists
          const { data: newSession, error } = await supabase
            .from('viewing_sessions')
            .insert({
              user_id: user.id,
              livestream_id: livestreamId,
              is_active: true,
              tab_visible: true,
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating viewing session:', error);
            return;
          }

          setSessionId(newSession.id);
          setWatchTime(0);
          accumulatedTimeRef.current = 0;
          console.log('Created new viewing session');
        }

        startTimeRef.current = Date.now();
        setIsSessionStarted(true);
        onTimerStart?.();
      } catch (error) {
        console.error('Error initializing viewing session:', error);
      }
    };

    initSession();
  }, [user, livestreamId, shouldStart, isSessionStarted]);

  // Send heartbeat updates every 30 seconds
  useEffect(() => {
    if (!sessionId || !user || !isSessionStarted) return;

    const sendHeartbeat = async () => {
      try {
        // Only count time when the external PumpFun window is open
        const isActivelyWatching = isExternalWindowOpen;
        const currentSessionTime = isActivelyWatching 
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;
        
        const totalTime = accumulatedTimeRef.current + currentSessionTime;
        
        await supabase
          .from('viewing_sessions')
          .update({
            last_active_at: new Date().toISOString(),
            total_watch_time: totalTime,
            tab_visible: isActivelyWatching,
          })
          .eq('id', sessionId);

        setWatchTime(totalTime);

        // Credit earnings every 60 seconds of watch time
        const previousMinutes = Math.floor(accumulatedTimeRef.current / 60);
        const currentMinutes = Math.floor(totalTime / 60);
        
        if (currentMinutes > previousMinutes && isActivelyWatching) {
          // Fetch livestream owner and credit earnings
          const { data: streamData } = await supabase
            .from('livestreams')
            .select('user_id')
            .eq('id', livestreamId)
            .single();
          
          if (streamData) {
            // Credit 1 minute worth of views (non-blocking)
            supabase.rpc('credit_view_earnings', {
              p_user_id: streamData.user_id,
              p_content_type: 'livestream',
              p_content_id: livestreamId,
              p_view_count: 60 // 60 seconds = 1 minute
            }).then(({ error: earningsError }) => {
              if (earningsError) console.error('Error crediting stream earnings:', earningsError);
            });
          }
        }

        // Reset start time after successful update
        if (isActivelyWatching) {
          accumulatedTimeRef.current = totalTime;
          startTimeRef.current = Date.now();
        }
      } catch (error) {
        console.error('Error sending heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for subsequent heartbeats
    intervalRef.current = setInterval(sendHeartbeat, 30000); // 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionId, user, isTabVisible, isExternalWindowOpen]);

  // Send final update on unmount but don't deactivate
  // Let the backend cron job handle session deactivation after prolonged inactivity
  useEffect(() => {
    return () => {
      if (sessionId) {
        // Send final time update only - only count time if external window is open
        const isActivelyWatching = isExternalWindowOpen;
        const finalTime = accumulatedTimeRef.current + 
          (isActivelyWatching ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0);
        
        supabase
          .from('viewing_sessions')
          .update({
            total_watch_time: finalTime,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .then(() => {
            console.log('Session paused, total watch time:', finalTime, 'seconds');
          });
      }
    };
  }, [sessionId, isExternalWindowOpen]);

  // Update watch time display every second (local only)
  useEffect(() => {
    // Only track time when external PumpFun window is open
    if (!isExternalWindowOpen) return;

    const displayInterval = setInterval(() => {
      const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setWatchTime(accumulatedTimeRef.current + currentSessionTime);
    }, 1000);

    return () => clearInterval(displayInterval);
  }, [isExternalWindowOpen]);

  const formatWatchTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
    watchTime,
    formattedWatchTime: formatWatchTime(watchTime),
    isTabVisible,
    meetsMinimumWatchTime: watchTime >= 300, // 5 minutes
    isSessionStarted,
  };
};
