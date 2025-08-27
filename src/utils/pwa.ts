// PWA utilities for service worker registration and management

export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAUpdateAvailable {
  waiting: ServiceWorker | null;
  skipWaiting(): void;
}

class PWAManager {
  private installPrompt: PWAInstallPrompt | null = null;
  private updateAvailable: PWAUpdateAvailable | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.setupInstallPrompt();
    this.setupUpdateListener();
  }

  // Register service worker with security features
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      this.registration = registration;

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          this.handleServiceWorkerUpdate(newWorker);
        }
      });

      // Check for updates periodically
      this.setupPeriodicUpdateCheck();

      console.log('Service Worker registered successfully');
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  // Handle service worker updates
  private handleServiceWorkerUpdate(newWorker: ServiceWorker) {
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New version available
        this.updateAvailable = {
          waiting: newWorker,
          skipWaiting: () => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        // Notify user about update
        this.notifyUpdateAvailable();
      }
    });
  }

  // Set up install prompt handling
  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as any;
      this.notifyInstallAvailable();
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.installPrompt = null;
      this.notifyInstallComplete();
    });
  }

  // Set up update listener
  private setupUpdateListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data);
      });
    }
  }

  // Handle messages from service worker
  private handleServiceWorkerMessage(data: any) {
    switch (data.type) {
      case 'PUSH_NOTIFICATION':
        this.handlePushNotification(data);
        break;
      case 'BACKGROUND_SYNC_RESULT':
        this.handleBackgroundSyncResult(data);
        break;
      case 'NAVIGATE':
        window.history.pushState(null, '', data.url);
        break;
      default:
        console.log('Unknown service worker message:', data);
    }
  }

  // Handle push notifications
  private handlePushNotification(data: any) {
    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('pwa-push-notification', {
      detail: data
    }));
  }

  // Handle background sync results
  private handleBackgroundSyncResult(data: any) {
    window.dispatchEvent(new CustomEvent('pwa-background-sync', {
      detail: data
    }));
  }

  // Prompt user to install PWA
  async promptInstall(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        console.log('User accepted PWA install');
        return true;
      } else {
        console.log('User dismissed PWA install');
        return false;
      }
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      return false;
    }
  }

  // Update to new service worker version
  updateServiceWorker() {
    if (this.updateAvailable) {
      this.updateAvailable.skipWaiting();
    }
  }

  // Check if PWA can be installed
  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  // Check if update is available
  hasUpdate(): boolean {
    return this.updateAvailable !== null;
  }

  // Set up periodic update checks
  private setupPeriodicUpdateCheck() {
    // Check for updates every 30 minutes
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 30 * 60 * 1000);
  }

  // Notify about install availability
  private notifyInstallAvailable() {
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  }

  // Notify about update availability
  private notifyUpdateAvailable() {
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  }

  // Notify about install completion
  private notifyInstallComplete() {
    window.dispatchEvent(new CustomEvent('pwa-install-complete'));
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  // Subscribe to push notifications
  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
      }

      // Get existing subscription
      let subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.getVapidPublicKey() as BufferSource
        });
      }

      console.log('Push subscription created:', subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  // Get VAPID public key (should be configured in environment)
  private getVapidPublicKey(): Uint8Array {
    // In production, this should come from environment variables
    const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f8HnKJuOmLsOBJXoXVqNOXNy6EqTXVBOWjuTgHpQBY0_mIDHpfE';

    const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
    const base64 = (vapidPublicKey + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  // Store data for offline use
  async storeOfflineData(key: string, data: any): Promise<void> {
    try {
      // Send to service worker for secure storage
      if (this.registration && this.registration.active) {
        this.registration.active.postMessage({
          type: 'STORE_OFFLINE_DATA',
          key,
          data
        });
      }
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  // Get offline data
  async getOfflineData(key: string): Promise<any> {
    try {
      // Request from service worker
      if (this.registration && this.registration.active) {
        return new Promise((resolve) => {
          const channel = new MessageChannel();

          channel.port1.onmessage = (event) => {
            resolve(event.data);
          };

          this.registration!.active!.postMessage({
            type: 'GET_OFFLINE_DATA',
            key
          }, [channel.port2]);
        });
      }
      return null;
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return null;
    }
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Utility functions
export const registerPWA = () => pwaManager.registerServiceWorker();
export const installPWA = () => pwaManager.promptInstall();
export const updatePWA = () => pwaManager.updateServiceWorker();
export const canInstallPWA = () => pwaManager.canInstall();
export const hasUpdatePWA = () => pwaManager.hasUpdate();
export const subscribeToPush = () => pwaManager.subscribeToPushNotifications();
export const storeOfflineData = (key: string, data: any) => pwaManager.storeOfflineData(key, data);
export const getOfflineData = (key: string) => pwaManager.getOfflineData(key);