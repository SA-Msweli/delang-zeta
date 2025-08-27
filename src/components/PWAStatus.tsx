import { useState } from 'react';
import { usePWA, useOnlineStatus } from '../hooks/usePWA';
import { Download, RefreshCw, Wifi, WifiOff, Bell, X } from 'lucide-react';

interface PWAStatusProps {
  className?: string;
}

export function PWAStatus({ className = '' }: PWAStatusProps) {
  const [pwaState, pwaActions] = usePWA();
  const isOnline = useOnlineStatus();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await pwaActions.install();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    pwaActions.update();
    // Update will trigger a page reload, so no need to reset loading state
  };

  const handleNotificationToggle = async () => {
    if (pwaState.notificationPermission === 'granted') {
      setShowNotifications(!showNotifications);
    } else {
      const permission = await pwaActions.requestNotifications();
      if (permission === 'granted') {
        await pwaActions.subscribeToPush();
        setShowNotifications(true);
      }
    }
  };

  if (pwaState.isInstalled && !pwaState.hasUpdate && isOnline) {
    return null; // Don't show anything when everything is working normally
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {/* Offline Status */}
      {!isOnline && (
        <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">You're offline</span>
        </div>
      )}

      {/* Install Prompt */}
      {pwaState.isInstallable && !pwaState.isInstalled && (
        <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Download className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Install DeLangZeta</h4>
                <p className="text-xs text-blue-100 mt-1">
                  Install the app for a better experience with offline support
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-blue-200 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>Install</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-blue-200 hover:text-white px-3 py-1 rounded text-xs"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Update Available */}
      {pwaState.hasUpdate && (
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Update Available</h4>
                <p className="text-xs text-green-100 mt-1">
                  A new version of DeLangZeta is ready to install
                </p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-white text-green-600 px-3 py-1 rounded text-xs font-medium hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  <span>Update Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notification Permission */}
      {pwaState.isInstalled && pwaState.notificationPermission === 'default' && (
        <div className="bg-purple-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-sm">Enable Notifications</h4>
                <p className="text-xs text-purple-100 mt-1">
                  Get notified about task updates and rewards
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-purple-200 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleNotificationToggle}
              className="bg-white text-purple-600 px-3 py-1 rounded text-xs font-medium hover:bg-purple-50 flex items-center space-x-1"
            >
              <Bell className="w-3 h-3" />
              <span>Enable</span>
            </button>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-purple-200 hover:text-white px-3 py-1 rounded text-xs"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Online Status Indicator */}
      {isOnline && (
        <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2 opacity-75">
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-xs">Online</span>
        </div>
      )}
    </div>
  );
}

// Offline fallback component
export function OfflineFallback() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📱</div>
        <h1 className="text-2xl font-bold text-white mb-4">You're Offline</h1>
        <p className="text-gray-400 mb-6">
          Some features may not be available while you're offline.
          Your actions will be synced when you're back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}

// PWA install button component
export function PWAInstallButton({ className = '' }: { className?: string }) {
  const [pwaState, pwaActions] = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!pwaState.isInstallable || pwaState.isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await pwaActions.install();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isInstalling ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Installing...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>Install App</span>
        </>
      )}
    </button>
  );
}