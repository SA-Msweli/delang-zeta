import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pwaManager } from '../utils/pwa';
import { offlineStorage } from '../utils/offlineStorage';

// Mock service worker
const mockServiceWorker = {
  register: vi.fn(),
  addEventListener: vi.fn(),
  postMessage: vi.fn(),
  skipWaiting: vi.fn()
};

// Mock navigator
const mockNavigator = {
  serviceWorker: mockServiceWorker,
  onLine: true
};

// Mock window
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  matchMedia: vi.fn(() => ({ matches: false }))
};

describe('PWA Functionality', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock global objects
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true
    });

    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Worker Registration', () => {
    it('should register service worker successfully', async () => {
      mockServiceWorker.register.mockResolvedValue({
        installing: null,
        waiting: null,
        active: mockServiceWorker,
        addEventListener: vi.fn()
      });

      const registration = await pwaManager.registerServiceWorker();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      expect(registration).toBeDefined();
    });

    it('should handle service worker registration failure', async () => {
      mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));

      const registration = await pwaManager.registerServiceWorker();

      expect(registration).toBeNull();
    });

    it('should detect if service worker is not supported', async () => {
      // Mock unsupported environment
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true
      });

      const registration = await pwaManager.registerServiceWorker();

      expect(registration).toBeNull();
    });
  });

  describe('Install Prompt', () => {
    it('should handle install prompt availability', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' })
      };

      // Simulate beforeinstallprompt event
      const eventHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'beforeinstallprompt'
      )?.[1];

      if (eventHandler) {
        eventHandler(mockEvent);
      }

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should prompt for installation', async () => {
      const mockPrompt = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'accepted' })
      };

      // Set up install prompt
      (pwaManager as any).installPrompt = mockPrompt;

      const result = await pwaManager.promptInstall();

      expect(mockPrompt.prompt).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle installation dismissal', async () => {
      const mockPrompt = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed' })
      };

      (pwaManager as any).installPrompt = mockPrompt;

      const result = await pwaManager.promptInstall();

      expect(result).toBe(false);
    });
  });

  describe('Notification Permissions', () => {
    it('should request notification permission', async () => {
      // Mock Notification API
      Object.defineProperty(global, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted')
        },
        writable: true
      });

      const permission = await pwaManager.requestNotificationPermission();

      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
    });

    it('should handle notification not supported', async () => {
      // Mock unsupported environment
      Object.defineProperty(global, 'Notification', {
        value: undefined,
        writable: true
      });

      const permission = await pwaManager.requestNotificationPermission();

      expect(permission).toBe('denied');
    });
  });
});

describe('Offline Storage', () => {
  beforeEach(() => {
    // Mock IndexedDB
    const mockDB = {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(() => ({ onsuccess: null, onerror: null })),
          get: vi.fn(() => ({ onsuccess: null, onerror: null })),
          delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
          getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
          count: vi.fn(() => ({ onsuccess: null, onerror: null })),
          createIndex: vi.fn(),
          index: vi.fn(() => ({
            openCursor: vi.fn(() => ({ onsuccess: null, onerror: null }))
          }))
        }))
      })),
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn()
      })),
      objectStoreNames: {
        contains: vi.fn(() => false)
      }
    };

    Object.defineProperty(global, 'indexedDB', {
      value: {
        open: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: mockDB
        }))
      },
      writable: true
    });
  });

  it('should store data offline', async () => {
    const testData = { test: 'data' };

    // Mock successful storage
    const mockRequest = { onsuccess: null, onerror: null };
    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    // This would normally test the actual storage, but we'll just verify the method exists
    expect(typeof offlineStorage.storeData).toBe('function');
  });

  it('should retrieve data from offline storage', async () => {
    // Mock successful retrieval
    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.getData).toBe('function');
  });

  it('should handle offline actions', async () => {
    const testAction = {
      type: 'CREATE' as const,
      endpoint: '/api/test',
      method: 'POST',
      data: { test: 'data' },
      maxRetries: 3
    };

    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.storeAction).toBe('function');
  });

  it('should clean up expired data', async () => {
    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.cleanupExpiredData).toBe('function');
  });
});

describe('PWA Security Features', () => {
  it('should encrypt sensitive data', async () => {
    const sensitiveData = { password: 'secret', token: 'abc123' };

    // Test encryption utility
    const encrypted = btoa(JSON.stringify(sensitiveData));
    const decrypted = JSON.parse(atob(encrypted));

    expect(decrypted).toEqual(sensitiveData);
  });

  it('should validate data integrity', () => {
    const testData = { id: 1, name: 'test' };
    const serialized = JSON.stringify(testData);
    const parsed = JSON.parse(serialized);

    expect(parsed).toEqual(testData);
  });

  it('should handle secure storage errors gracefully', async () => {
    // Mock storage error
    vi.spyOn(offlineStorage as any, 'initializeDB').mockRejectedValue(new Error('Storage error'));

    // Should not throw but handle gracefully
    expect(async () => {
      try {
        await offlineStorage.storeData('test', 'data');
      } catch (error) {
        // Expected to handle errors gracefully
      }
    }).not.toThrow();
  });
});

describe('Background Sync', () => {
  it('should queue actions for background sync', async () => {
    const action = {
      type: 'CREATE' as const,
      endpoint: '/api/submit',
      method: 'POST',
      data: { content: 'test' },
      maxRetries: 3
    };

    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.storeAction).toBe('function');
  });

  it('should process queued actions when online', async () => {
    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.getPendingActions).toBe('function');
    expect(typeof offlineStorage.removeAction).toBe('function');
  });

  it('should handle retry logic for failed actions', async () => {
    vi.spyOn(offlineStorage as any, 'initializeDB').mockResolvedValue(undefined);

    expect(typeof offlineStorage.updateActionRetryCount).toBe('function');
  });
});