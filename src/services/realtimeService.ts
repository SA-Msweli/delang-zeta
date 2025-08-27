import { apiClient } from '../config/api';
import { TokenManager } from './tokenManager';

export interface RealtimeEvent {
  id: string;
  type: 'task_update' | 'submission_update' | 'validation_update' | 'reward_distributed' | 'blockchain_event';
  userId?: string;
  taskId?: string;
  submissionId?: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface SyncRequest {
  collections: string[];
  lastSyncTimestamp?: Date;
}

export interface SyncResponse {
  updates: Array<{
    id: string;
    collection: string;
    data: any;
    timestamp: Date;
    userId?: string;
  }>;
  deletions: string[];
  timestamp: Date;
  hasMore: boolean;
}

export interface NotificationPreferences {
  enablePushNotifications: boolean;
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  taskUpdates: boolean;
  validationUpdates: boolean;
  rewardNotifications: boolean;
  governanceUpdates: boolean;
  marketplaceUpdates: boolean;
  privacyLevel: 'public' | 'private' | 'anonymous';
}

export interface BlockchainEvent {
  eventType: string;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  data: any;
  timestamp: Date;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private eventListeners: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTimestamp: Date | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  private constructor() {
    this.setupServiceWorkerMessaging();
  }

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Initialize real-time connection and setup listeners
   */
  async initialize(collections: string[] = ['tasks', 'user_submissions', 'user_validations', 'user_rewards']): Promise<void> {
    try {
      if (!TokenManager.hasValidTokens()) {
        console.warn('No valid tokens available for real-time connection');
        return;
      }

      // Setup real-time listeners on the server
      await this.setupServerListeners(collections);

      // Start periodic sync
      this.startPeriodicSync(collections);

      // Setup push notification service worker
      await this.setupPushNotifications();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('Real-time service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize real-time service:', error);
      this.scheduleReconnect(collections);
    }
  }

  /**
   * Disconnect and cleanup resources
   */
  disconnect(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isConnected = false;
    this.eventListeners.clear();
    console.log('Real-time service disconnected');
  }

  /**
   * Subscribe to real-time events
   */
  subscribe(eventType: string, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Sync data with server
   */
  async syncData(collections: string[]): Promise<SyncResponse> {
    try {
      const request: SyncRequest = {
        collections,
        lastSyncTimestamp: this.lastSyncTimestamp || undefined
      };

      const response = await apiClient.post('/realtime/sync', request);
      const syncResponse: SyncResponse = response.data.data;

      // Update last sync timestamp
      this.lastSyncTimestamp = new Date(syncResponse.timestamp);

      // Process updates and emit events
      this.processUpdates(syncResponse.updates);

      return syncResponse;
    } catch (error: any) {
      console.error('Failed to sync data:', error);

      if (error.response?.status === 401) {
        // Token expired, try to refresh
        try {
          // Token refresh would be handled by the API client interceptor
          return this.syncData(collections);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          throw new Error('Authentication failed');
        }
      }

      throw error;
    }
  }

  /**
   * Get blockchain event history
   */
  async getBlockchainEvents(
    eventType?: string,
    fromBlock?: number,
    toBlock?: number,
    limit = 100
  ): Promise<BlockchainEvent[]> {
    try {
      const params = new URLSearchParams();
      if (eventType) params.append('eventType', eventType);
      if (fromBlock) params.append('fromBlock', fromBlock.toString());
      if (toBlock) params.append('toBlock', toBlock.toString());
      params.append('limit', limit.toString());

      const response = await apiClient.get(`/realtime/blockchain/events?${params}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get blockchain events:', error);
      return [];
    }
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.get('/realtime/notifications/preferences');
      return response.data.data;
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      await apiClient.put('/realtime/notifications/preferences', preferences);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  /**
   * Register device for push notifications
   */
  async registerForPushNotifications(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        return false;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.VITE_VAPID_PUBLIC_KEY || ''
        ) as BufferSource
      });

      // Send subscription to server
      await apiClient.post('/realtime/notifications/device-token', {
        token: JSON.stringify(subscription),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      });

      console.log('Push notifications registered successfully');
      return true;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return false;
    }
  }

  /**
   * Unregister from push notifications
   */
  async unregisterFromPushNotifications(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) {
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        await apiClient.delete('/realtime/notifications/device-token', {
          data: { token: JSON.stringify(subscription) }
        });
      }

      console.log('Push notifications unregistered successfully');
    } catch (error) {
      console.error('Failed to unregister from push notifications:', error);
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(limit = 50, offset = 0): Promise<any[]> {
    try {
      const response = await apiClient.get(
        `/realtime/notifications/history?limit=${limit}&offset=${offset}`
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await apiClient.put(`/realtime/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      const response = await apiClient.post('/realtime/notifications/test');
      return response.data.delivered;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }

  private async setupServerListeners(collections: string[]): Promise<void> {
    try {
      await apiClient.post('/realtime/listeners/setup', { collections });
      console.log('Server listeners setup successfully');
    } catch (error) {
      console.error('Failed to setup server listeners:', error);
      throw error;
    }
  }

  private startPeriodicSync(collections: string[]): void {
    // Sync every 30 seconds
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncData(collections);
      } catch (error) {
        console.error('Periodic sync failed:', error);
        this.scheduleReconnect(collections);
      }
    }, 30000);
  }

  private processUpdates(updates: SyncResponse['updates']): void {
    updates.forEach(update => {
      const event: RealtimeEvent = {
        id: `sync_${update.id}_${Date.now()}`,
        type: this.getEventTypeFromCollection(update.collection),
        userId: update.userId,
        data: {
          changeType: 'updated',
          documentId: update.id,
          collection: update.collection,
          data: update.data
        },
        timestamp: new Date(update.timestamp),
        priority: 'low'
      };

      this.emitEvent(event);
    });
  }

  private getEventTypeFromCollection(collection: string): RealtimeEvent['type'] {
    switch (collection) {
      case 'tasks':
        return 'task_update';
      case 'submissions':
      case 'user_submissions':
        return 'submission_update';
      case 'validations':
      case 'user_validations':
        return 'validation_update';
      case 'rewards':
      case 'user_rewards':
        return 'reward_distributed';
      default:
        return 'task_update';
    }
  }

  private emitEvent(event: RealtimeEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  private scheduleReconnect(collections: string[]): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.isConnected = false;
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.initialize(collections);
    }, delay);
  }

  private setupServiceWorkerMessaging(): void {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
        const realtimeEvent: RealtimeEvent = {
          id: `push_${Date.now()}`,
          type: event.data.notificationType || 'task_update',
          data: event.data.data,
          timestamp: new Date(),
          priority: 'high'
        };

        this.emitEvent(realtimeEvent);
      }
    });
  }

  private async setupPushNotifications(): Promise<void> {
    try {
      const preferences = await this.getNotificationPreferences();

      if (preferences.enablePushNotifications) {
        await this.registerForPushNotifications();
      }
    } catch (error) {
      console.error('Failed to setup push notifications:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Getters
  get connected(): boolean {
    return this.isConnected;
  }

  get lastSync(): Date | null {
    return this.lastSyncTimestamp;
  }
}

export const realtimeService = RealtimeService.getInstance();