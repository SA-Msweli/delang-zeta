import { useEffect, useState, useCallback, useRef } from 'react';
import { realtimeService, RealtimeEvent } from '../services/realtimeService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface UseRealtimeOptions {
  collections?: string[];
  autoConnect?: boolean;
  enableNotifications?: boolean;
  eventTypes?: string[];
}

export interface RealtimeState {
  connected: boolean;
  lastSync: Date | null;
  events: RealtimeEvent[];
  error: string | null;
  reconnecting: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    collections = ['tasks', 'user_submissions', 'user_validations', 'user_rewards'],
    autoConnect = true,
    enableNotifications = true,
    eventTypes = ['all']
  } = options;

  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    lastSync: null,
    events: [],
    error: null,
    reconnecting: false
  });

  const unsubscribeFunctions = useRef<(() => void)[]>([]);
  const maxEvents = 100; // Keep only last 100 events in memory

  // Connect to real-time service
  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      setState(prev => ({ ...prev, error: 'Authentication required' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, reconnecting: true, error: null }));

      await realtimeService.initialize(collections);

      setState(prev => ({
        ...prev,
        connected: realtimeService.connected,
        lastSync: realtimeService.lastSync,
        reconnecting: false
      }));

      if (enableNotifications) {
        toast.success('Real-time updates connected');
      }
    } catch (error: any) {
      console.error('Failed to connect to real-time service:', error);
      setState(prev => ({
        ...prev,
        connected: false,
        reconnecting: false,
        error: error.message || 'Connection failed'
      }));

      if (enableNotifications) {
        toast.error('Failed to connect to real-time updates');
      }
    }
  }, [isAuthenticated, collections, enableNotifications]);

  // Disconnect from real-time service
  const disconnect = useCallback(() => {
    // Unsubscribe from all events
    unsubscribeFunctions.current.forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = [];

    realtimeService.disconnect();

    setState(prev => ({
      ...prev,
      connected: false,
      events: [],
      error: null,
      reconnecting: false
    }));

    if (enableNotifications) {
      toast.success('Real-time updates disconnected');
    }
  }, [enableNotifications]);

  // Subscribe to events
  const subscribeToEvents = useCallback(() => {
    // Clear existing subscriptions
    unsubscribeFunctions.current.forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = [];

    eventTypes.forEach(eventType => {
      const unsubscribe = realtimeService.subscribe(eventType, (event: RealtimeEvent) => {
        setState(prev => {
          const newEvents = [event, ...prev.events].slice(0, maxEvents);
          return {
            ...prev,
            events: newEvents,
            lastSync: new Date()
          };
        });

        // Show notification for high priority events
        if (event.priority === 'high' && enableNotifications) {
          showEventNotification(event);
        }
      });

      unsubscribeFunctions.current.push(unsubscribe);
    });
  }, [eventTypes, enableNotifications]);

  // Show notification for events
  const showEventNotification = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case 'reward_distributed':
        toast.success(`🎉 Reward received: ${event.data.amount} ${event.data.token}`, {
          duration: 5000
        });
        break;

      case 'validation_update':
        if (event.data.approved) {
          toast.success(`✅ Submission approved with score ${event.data.finalScore}/100`);
        } else {
          toast.error(`❌ Submission needs revision (score: ${event.data.finalScore}/100)`);
        }
        break;

      case 'task_update':
        if (event.data.action === 'created') {
          toast(`📝 New task available: ${event.data.reward} reward`, {
            icon: '🆕'
          });
        }
        break;

      case 'submission_update':
        if (event.data.action === 'submitted') {
          toast.success('📤 Submission received and processing');
        }
        break;

      default:
        // Generic notification for other events
        if (event.priority === 'high') {
          toast(`🔔 ${event.type.replace('_', ' ')} update`);
        }
        break;
    }
  }, []);

  // Sync data manually
  const syncData = useCallback(async () => {
    if (!isAuthenticated || !realtimeService.connected) {
      return;
    }

    try {
      const syncResponse = await realtimeService.syncData(collections);

      setState(prev => ({
        ...prev,
        lastSync: new Date(syncResponse.timestamp),
        error: null
      }));

      return syncResponse;
    } catch (error: any) {
      console.error('Manual sync failed:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Sync failed'
      }));
      throw error;
    }
  }, [isAuthenticated, collections]);

  // Clear events
  const clearEvents = useCallback(() => {
    setState(prev => ({ ...prev, events: [] }));
  }, []);

  // Get events by type
  const getEventsByType = useCallback((type: string) => {
    return state.events.filter(event => event.type === type);
  }, [state.events]);

  // Get events by priority
  const getEventsByPriority = useCallback((priority: 'low' | 'medium' | 'high') => {
    return state.events.filter(event => event.priority === priority);
  }, [state.events]);

  // Get recent events (last N events)
  const getRecentEvents = useCallback((count: number = 10) => {
    return state.events.slice(0, count);
  }, [state.events]);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && autoConnect) {
      connect();
    } else if (!isAuthenticated) {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, autoConnect, connect, disconnect]);

  // Subscribe to events when connected
  useEffect(() => {
    if (state.connected) {
      subscribeToEvents();
    }

    return () => {
      unsubscribeFunctions.current.forEach(unsubscribe => unsubscribe());
      unsubscribeFunctions.current = [];
    };
  }, [state.connected, subscribeToEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    syncData,
    clearEvents,

    // Getters
    getEventsByType,
    getEventsByPriority,
    getRecentEvents,

    // Computed
    hasEvents: state.events.length > 0,
    highPriorityEvents: state.events.filter(e => e.priority === 'high'),
    unreadCount: state.events.length // In a real app, you'd track read status
  };
}

// Hook for specific event types
export function useRealtimeEvents(eventType: string) {
  const { events, getEventsByType, ...rest } = useRealtime({
    eventTypes: [eventType]
  });

  return {
    events: getEventsByType(eventType),
    ...rest
  };
}

// Hook for task updates
export function useTaskUpdates() {
  return useRealtimeEvents('task_update');
}

// Hook for submission updates
export function useSubmissionUpdates() {
  return useRealtimeEvents('submission_update');
}

// Hook for validation updates
export function useValidationUpdates() {
  return useRealtimeEvents('validation_update');
}

// Hook for reward updates
export function useRewardUpdates() {
  return useRealtimeEvents('reward_distributed');
}

// Hook for blockchain events
export function useBlockchainEvents() {
  return useRealtimeEvents('blockchain_event');
}