import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

interface UseViewingSessionProps {
  livestreamId: string;
  shouldStart?: boolean;
  onTimerStart?: () => void;
}

export const useViewingSession = ({ livestreamId, shouldStart = false, onTimerStart }: UseViewingSessionProps) => {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [watchTime, setWatchTime] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedTimeRef = useRef<number>(0);
  const livestreamOwnerRef = useRef<string | null>(null);
  const lastCreditedMinuteRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastWatchTimeRef = useRef<number>(0);

  // Use Page Visibility API for both mobile and desktop
  useEffect(() => {
    if (!shouldStart) {
      setIsTracking(false);
      return;
    }

    // Start timer immediately
    setIsTracking(true);
    setIsSessionStarted(true);
    startTimeRef.current = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden, pause timer
        const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        accumulatedTimeRef.current += currentSessionTime;
        setIsTracking(false);
      } else {
        // Tab visible, resume timer
        setIsTracking(true);
        startTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Update watch time display
    const updateDisplay = () => {
      if (!document.hidden) {
        const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const newWatchTime = accumulatedTimeRef.current + currentSessionTime;
        
        if (newWatchTime !== lastWatchTimeRef.current) {
          lastWatchTimeRef.current = newWatchTime;
          setWatchTime(newWatchTime);
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    };

    animationFrameRef.current = requestAnimationFrame(updateDisplay);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shouldStart]);

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

  // Send heartbeat updates every 30 seconds
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !isTracking) return; // Skip if paused

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
  }, [sessionId, livestreamId, isTracking]);

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

  // Send final update on unmount
  useEffect(() => {
    return () => {
      if (sessionId && isTracking) {
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
  }, [sessionId, isTracking]);

  const formatWatchTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
    watchTime,
    formattedWatchTime: formatWatchTime(watchTime),
    isTabVisible: isTracking,
    meetsMinimumWatchTime: watchTime >= 300, // 5 minutes
    isSessionStarted,
    isTracking,
  };
};
