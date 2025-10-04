import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [isExternalWindowOpen, setIsExternalWindowOpen] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedTimeRef = useRef<number>(0);
  const livestreamOwnerRef = useRef<string | null>(null);
  const lastCreditedMinuteRef = useRef<number>(0);
  const closedCheckCountRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastWatchTimeRef = useRef<number>(0);

  // Optimized: Consolidated window polling and display update using requestAnimationFrame
  useEffect(() => {
    if (!externalWindow) {
      setIsExternalWindowOpen(false);
      closedCheckCountRef.current = 0;
      return;
    }

    setIsExternalWindowOpen(true);
    closedCheckCountRef.current = 0;

    let lastCheckTime = Date.now();
    const CHECK_INTERVAL = 1000; // Check every second
    const DEBOUNCE_CHECKS = 2; // Require 2 consecutive closed checks

    const checkWindowAndUpdateDisplay = () => {
      const now = Date.now();
      
      // Check window status every second
      if (now - lastCheckTime >= CHECK_INTERVAL) {
        lastCheckTime = now;
        
        try {
          if (externalWindow.closed) {
            closedCheckCountRef.current++;
            
            // Only update state after consecutive closed checks (debouncing)
            if (closedCheckCountRef.current >= DEBOUNCE_CHECKS && isExternalWindowOpen) {
              setIsExternalWindowOpen(false);
              const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
              accumulatedTimeRef.current += currentSessionTime;
              console.log('External window closed, pausing timer');
            }
          } else {
            closedCheckCountRef.current = 0;
            if (!isExternalWindowOpen) {
              setIsExternalWindowOpen(true);
              startTimeRef.current = Date.now();
            }
          }
        } catch (error) {
          closedCheckCountRef.current++;
          if (closedCheckCountRef.current >= DEBOUNCE_CHECKS && isExternalWindowOpen) {
            console.log('Error checking window status, assuming closed');
            setIsExternalWindowOpen(false);
          }
        }
      }

      // Update display if window is open - only if value changed
      if (isExternalWindowOpen) {
        const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const newWatchTime = accumulatedTimeRef.current + currentSessionTime;
        
        if (newWatchTime !== lastWatchTimeRef.current) {
          lastWatchTimeRef.current = newWatchTime;
          setWatchTime(newWatchTime);
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkWindowAndUpdateDisplay);
    };

    animationFrameRef.current = requestAnimationFrame(checkWindowAndUpdateDisplay);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [externalWindow, isExternalWindowOpen]);

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

  // Optimized: Cache livestream owner on session start
  useEffect(() => {
    if (!livestreamId || livestreamOwnerRef.current) return;

    supabase
      .from('livestreams')
      .select('user_id')
      .eq('id', livestreamId)
      .single()
      .then(({ data }) => {
        if (data) {
          livestreamOwnerRef.current = data.user_id;
        }
      });
  }, [livestreamId]);

  // Optimized: Send heartbeat updates every 30 seconds - skip when window closed
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !isExternalWindowOpen) return; // Skip if window closed

    try {
      const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const totalTime = accumulatedTimeRef.current + currentSessionTime;
      
      // Batch database update
      await supabase
        .from('viewing_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          total_watch_time: totalTime,
          tab_visible: true,
        })
        .eq('id', sessionId);

      // Credit earnings every 60 seconds - use cached owner and flag to prevent duplicates
      const currentMinutes = Math.floor(totalTime / 60);
      
      if (currentMinutes > lastCreditedMinuteRef.current && livestreamOwnerRef.current) {
        lastCreditedMinuteRef.current = currentMinutes;
        
        // Non-blocking earnings credit
        supabase.rpc('credit_view_earnings', {
          p_user_id: livestreamOwnerRef.current,
          p_content_type: 'livestream',
          p_content_id: livestreamId,
          p_view_count: 60
        }).then(({ error: earningsError }) => {
          if (earningsError) console.error('Error crediting stream earnings:', earningsError);
        });
      }

      // Reset start time after successful update
      accumulatedTimeRef.current = totalTime;
      startTimeRef.current = Date.now();
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }, [sessionId, livestreamId, isExternalWindowOpen]);

  useEffect(() => {
    if (!sessionId || !user || !isSessionStarted) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for subsequent heartbeats
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [sessionId, user, isSessionStarted, sendHeartbeat]);

  // Optimized: Send final update on unmount
  useEffect(() => {
    return () => {
      if (sessionId && isExternalWindowOpen) {
        const finalTime = accumulatedTimeRef.current + 
          Math.floor((Date.now() - startTimeRef.current) / 1000);
        
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

  const formatWatchTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
    watchTime,
    formattedWatchTime: formatWatchTime(watchTime),
    isTabVisible: isExternalWindowOpen, // Keep for backward compatibility
    meetsMinimumWatchTime: watchTime >= 300, // 5 minutes
    isSessionStarted,
  };
};
