import { useState, useEffect, useCallback } from 'react';
import { pwaManager } from '../utils/pwa';

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  isOnline: boolean;
  notificationPermission: NotificationPermission;
  pushSubscription: PushSubscription | null;
}

export interface PWAActions {
  install: () => Promise<boolean>;
  update: () => void;
  requestNotifications: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<PushSubscription | null>;
  storeOffline: (key: string, data: any) => Promise<void>;
  getOffline: (key: string) => Promise<any>;
}

export function usePWA(): [PWAState, PWAActions] {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    hasUpdate: false,
    isOnline: navigator.onLine,
    notificationPermission: 'Notification' in window ? Notification.permission : 'denied',
    pushSubscription: null
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<PWAState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize PWA
  useEffect(() => {
    const initializePWA = async () => {
      // Register service worker
      await pwaManager.registerServiceWorker();

      // Check initial state
      updateState({
        isInstallable: pwaManager.canInstall(),
        hasUpdate: pwaManager.hasUpdate(),
        isInstalled: window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          (window.navigator as any).standalone === true
      });
    };

    initializePWA();
  }, [updateState]);

  // Set up event listeners
  useEffect(() => {
    const handleOnline = () => updateState({ isOnline: true });
    const handleOffline = () => updateState({ isOnline: false });

    const handleInstallAvailable = () => updateState({ isInstallable: true });
    const handleInstallComplete = () => {
      updateState({
        isInstallable: false,
        isInstalled: true
      });
    };

    const handleUpdateAvailable = () => updateState({ hasUpdate: true });

    const handlePushNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Push notification received:', customEvent.detail);
      // Handle push notification in app
    };

    const handleBackgroundSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Background sync completed:', customEvent.detail);
      // Handle sync result in app
    };

    // Network status
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA events
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-complete', handleInstallComplete);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-push-notification', handlePushNotification);
    window.addEventListener('pwa-background-sync', handleBackgroundSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-complete', handleInstallComplete);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-push-notification', handlePushNotification);
      window.removeEventListener('pwa-background-sync', handleBackgroundSync);
    };
  }, [updateState]);

  // Actions
  const actions: PWAActions = {
    install: async () => {
      const success = await pwaManager.promptInstall();
      if (success) {
        updateState({ isInstallable: false, isInstalled: true });
      }
      return success;
    },

    update: () => {
      pwaManager.updateServiceWorker();
      updateState({ hasUpdate: false });
    },

    requestNotifications: async () => {
      const permission = await pwaManager.requestNotificationPermission();
      updateState({ notificationPermission: permission });
      return permission;
    },

    subscribeToPush: async () => {
      const subscription = await pwaManager.subscribeToPushNotifications();
      updateState({ pushSubscription: subscription });
      return subscription;
    },

    storeOffline: async (key: string, data: any) => {
      await pwaManager.storeOfflineData(key, data);
    },

    getOffline: async (key: string) => {
      return await pwaManager.getOfflineData(key);
    }
  };

  return [state, actions];
}

// Hook for offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Hook for PWA install prompt
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as any).standalone === true
  );

  useEffect(() => {
    const handleInstallAvailable = () => setCanInstall(true);
    const handleInstallComplete = () => {
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-complete', handleInstallComplete);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-complete', handleInstallComplete);
    };
  }, []);

  const install = useCallback(async () => {
    const success = await pwaManager.promptInstall();
    if (success) {
      setCanInstall(false);
      setIsInstalled(true);
    }
    return success;
  }, []);

  return { canInstall, isInstalled, install };
}