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
  const [hasWindowFocus, setHasWindowFocus] = useState(true);
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

    setIsExternalWindowOpen(!externalWindow.closed);

    const checkInterval = setInterval(() => {
      const isOpen = !externalWindow.closed;
      if (isExternalWindowOpen !== isOpen) {
        setIsExternalWindowOpen(isOpen);
        
        if (!isOpen) {
          // Window closed - accumulate current session time
          const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
          accumulatedTimeRef.current += currentSessionTime;
        } else {
          // Window reopened - reset start time
          startTimeRef.current = Date.now();
        }
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [externalWindow, isExternalWindowOpen]);

  // Handle visibility and focus changes
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

    const handleFocus = () => {
      setHasWindowFocus(true);
      // Window regained focus - reset start time
      startTimeRef.current = Date.now();
    };

    const handleBlur = () => {
      setHasWindowFocus(false);
      // Window lost focus - accumulate current session time
      const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      accumulatedTimeRef.current += currentSessionTime;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Create or resume viewing session
  useEffect(() => {
    if (!user || !livestreamId || !shouldStart) return;
    if (isSessionStarted) return; // Prevent duplicate initialization

    const initSession = async () => {
      try {
        // Check for existing active session
        const { data: existingSessions } = await supabase
          .from('viewing_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('livestream_id', livestreamId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingSessions && existingSessions.length > 0) {
          // Resume existing session
          const session = existingSessions[0];
          setSessionId(session.id);
          setWatchTime(session.total_watch_time);
          accumulatedTimeRef.current = session.total_watch_time;
        } else {
          // Create new session
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
        // Only count time if tab is visible AND window has focus AND external window is open
        const isActivelyWatching = isTabVisible && hasWindowFocus && isExternalWindowOpen;
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
  }, [sessionId, user, isTabVisible, hasWindowFocus, isExternalWindowOpen]);

  // Mark session as inactive on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        // Send final update
        const isActivelyWatching = isTabVisible && hasWindowFocus && isExternalWindowOpen;
        const finalTime = accumulatedTimeRef.current + 
          (isActivelyWatching ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0);
        
        supabase
          .from('viewing_sessions')
          .update({
            is_active: false,
            total_watch_time: finalTime,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .then(() => {
            console.log('Session ended, total watch time:', finalTime, 'seconds');
          });
      }
    };
  }, [sessionId, isTabVisible, hasWindowFocus, isExternalWindowOpen]);

  // Update watch time display every second (local only)
  useEffect(() => {
    const isActivelyWatching = isTabVisible && hasWindowFocus && isExternalWindowOpen;
    if (!isActivelyWatching) return;

    const displayInterval = setInterval(() => {
      const currentSessionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setWatchTime(accumulatedTimeRef.current + currentSessionTime);
    }, 1000);

    return () => clearInterval(displayInterval);
  }, [isTabVisible, hasWindowFocus, isExternalWindowOpen]);

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
