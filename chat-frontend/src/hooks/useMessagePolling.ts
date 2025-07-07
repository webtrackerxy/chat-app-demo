import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface UseMessagePollingProps {
  storageMode: 'local' | 'backend';
  loadMessages: (conversationId: string) => Promise<void>;
  conversationId: string;
  isEnabled?: boolean;
}

export const useMessagePolling = ({
  storageMode,
  loadMessages,
  conversationId,
  isEnabled = true,
}: UseMessagePollingProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Configuration for polling intervals
  const POLLING_INTERVAL = 3000; // 3 seconds for local mode
  const BACKEND_POLLING_INTERVAL = 5000; // 5 seconds for backend mode

  const startPolling = useCallback(() => {
    if (!isEnabled) return;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const pollInterval = storageMode === 'backend' ? BACKEND_POLLING_INTERVAL : POLLING_INTERVAL;
    
    intervalRef.current = setInterval(() => {
      // Only poll if app is active and screen is focused
      if (appStateRef.current === 'active') {
        loadMessages(conversationId);
      }
    }, pollInterval);
  }, [storageMode, loadMessages, conversationId, isEnabled]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const restartPolling = useCallback(() => {
    stopPolling();
    startPolling();
  }, [stopPolling, startPolling]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active' && isEnabled) {
        // App became active, start polling
        startPolling();
      } else {
        // App went to background, stop polling to save battery
        stopPolling();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [startPolling, stopPolling, isEnabled]);

  // Start/stop polling when screen is focused/unfocused
  useFocusEffect(
    useCallback(() => {
      if (!isEnabled) return;
      
      // Screen focused - start polling
      startPolling();
      
      return () => {
        // Screen unfocused - stop polling
        stopPolling();
      };
    }, [startPolling, stopPolling, isEnabled])
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    restartPolling,
    isPolling: intervalRef.current !== null,
  };
};