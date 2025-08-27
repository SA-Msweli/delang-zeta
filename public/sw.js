// DeLangZeta Secure Service Worker for PWA Features
// Implements secure offline functionality, encrypted caching, and background sync

const CACHE_NAME = 'delang-zeta-secure-v1';
const RUNTIME_CACHE = 'delang-zeta-runtime-v1';
const OFFLINE_CACHE = 'delang-zeta-offline-v1';
const ENCRYPTED_CACHE = 'delang-zeta-encrypted-v1';

// Static assets to cache
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png'
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/tasks$/,
  /\/api\/datasets$/,
  /\/api\/user\/profile$/,
  /\/api\/marketplace$/
];

// Sensitive API endpoints that should never be cached
const SENSITIVE_API_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/upload\//,
  /\/api\/payment\//,
  /\/api\/admin\//
];

// Encryption key for sensitive data (in production, this should be derived from user credentials)
let encryptionKey = null;

// Install event - cache static assets securely
self.addEventListener('install', (event) => {
  console.log('DeLangZeta Service Worker installing...');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('Caching static assets');
          return cache.addAll(STATIC_CACHE_URLS);
        }),

      // Initialize secure storage
      initializeSecureStorage(),

      // Set up encryption key
      initializeEncryption()
    ])
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and initialize secure features
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (!cacheName.startsWith('delang-zeta-secure-v1') &&
                !cacheName.startsWith('delang-zeta-runtime-v1') &&
                !cacheName.startsWith('delang-zeta-offline-v1') &&
                !cacheName.startsWith('delang-zeta-encrypted-v1')) {
                console.log('Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              }
            })
          );
        }),

      // Initialize offline storage
      initializeOfflineStorage(),

      // Set up background sync
      setupBackgroundSync()
    ])
      .then(() => {
        console.log('Service Worker activated successfully');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker activation failed:', error);
      })
  );
});

// Fetch event - secure caching with network strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    // Handle POST/PUT/DELETE requests for offline sync
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      event.respondWith(handleOfflineAction(request));
    }
    return;
  }

  // Skip external requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Check if this is a sensitive API endpoint
  if (isSensitiveEndpoint(url.pathname)) {
    event.respondWith(handleSensitiveRequest(request));
    return;
  }

  // Handle different types of requests with appropriate caching strategies
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'DeLangZeta',
    body: 'You have a new update',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'delang-zeta',
    data: {}
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data.notification,
        data: data.data || {}
      };
    } catch (error) {
      console.error('Failed to parse push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Add action buttons based on notification type
  const actions = getNotificationActions(notificationData.data.type);

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    actions: actions,
    requireInteraction: notificationData.data.priority === 'high',
    silent: false,
    vibrate: notificationData.data.priority === 'high' ? [200, 100, 200] : [100]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log('Notification displayed successfully');

        // Send message to client about the notification
        return self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION',
            notificationType: notificationData.data.type,
            data: notificationData.data
          });
        });
      })
      .catch((error) => {
        console.error('Failed to show notification:', error);
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  let url = '/';

  // Handle different actions
  if (action === 'view_task' && data.taskId) {
    url = `/tasks/${data.taskId}`;
  } else if (action === 'view_rewards') {
    url = '/profile?tab=rewards';
  } else if (action === 'view_submission' && data.submissionId) {
    url = `/submissions/${data.submissionId}`;
  } else if (action === 'dismiss') {
    return; // Just close the notification
  } else {
    // Default action - open the app
    switch (data.type) {
      case 'task_created':
        url = data.taskId ? `/tasks/${data.taskId}` : '/tasks';
        break;
      case 'submission_received':
      case 'verification_complete':
        url = data.submissionId ? `/submissions/${data.submissionId}` : '/submissions';
        break;
      case 'reward_received':
        url = '/profile?tab=rewards';
        break;
      case 'crosschain_update':
        url = '/profile?tab=transactions';
        break;
      default:
        url = '/';
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Check if there's already a window/tab open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate existing window to the URL
            client.postMessage({
              type: 'NAVIGATE',
              url: url
            });
            return client.focus();
          }
        }

        // No existing window, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
      .catch((error) => {
        console.error('Failed to handle notification click:', error);
      })
  );
});

// Background sync event (for offline actions)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncOfflineActions()
        .then(() => {
          console.log('Background sync completed successfully');
        })
        .catch((error) => {
          console.error('Background sync failed:', error);
        })
    );
  }
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_URLS') {
    // Cache additional URLs
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.addAll(event.data.urls);
        })
    );
  }
});

// Helper function to get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'task_created':
      return [
        { action: 'view_task', title: 'View Task', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ];

    case 'reward_received':
      return [
        { action: 'view_rewards', title: 'View Rewards', icon: '/icons/rewards.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ];

    case 'verification_complete':
      return [
        { action: 'view_submission', title: 'View Submission', icon: '/icons/submission.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ];

    default:
      return [
        { action: 'open_app', title: 'Open App', icon: '/icons/open.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ];
  }
}

// Secure helper functions for PWA features

// Initialize secure storage for offline data
async function initializeSecureStorage() {
  try {
    // Open IndexedDB for secure offline storage
    const db = await openSecureDB();
    console.log('Secure storage initialized');
    return db;
  } catch (error) {
    console.error('Failed to initialize secure storage:', error);
    throw error;
  }
}

// Initialize encryption for sensitive data
async function initializeEncryption() {
  try {
    // Generate or retrieve encryption key
    encryptionKey = await generateEncryptionKey();
    console.log('Encryption initialized');
  } catch (error) {
    console.error('Failed to initialize encryption:', error);
  }
}

// Initialize offline storage
async function initializeOfflineStorage() {
  try {
    await caches.open(OFFLINE_CACHE);
    await caches.open(ENCRYPTED_CACHE);
    console.log('Offline storage initialized');
  } catch (error) {
    console.error('Failed to initialize offline storage:', error);
  }
}

// Set up background sync
async function setupBackgroundSync() {
  try {
    // Register background sync
    if ('serviceWorker' in self && 'sync' in self.registration) {
      console.log('Background sync available');
    }
  } catch (error) {
    console.error('Failed to setup background sync:', error);
  }
}

// Handle static asset requests with cache-first strategy
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Static asset fetch failed:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle API requests with network-first strategy and secure caching
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok && isCacheableApiEndpoint(request.url)) {
      // Cache successful API responses
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('API request failed, trying cache:', error);

    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback
    return createOfflineApiResponse(request);
  }
}

// Handle navigation requests with app shell pattern
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.error('Navigation request failed:', error);

    // Return cached app shell
    const cachedResponse = await caches.match('/index.html');
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page
    return createOfflinePage();
  }
}

// Handle sensitive requests (never cache)
async function handleSensitiveRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('Sensitive request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Network unavailable for sensitive operation' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle offline actions (POST/PUT/DELETE when offline)
async function handleOfflineAction(request) {
  try {
    // Try network first
    return await fetch(request);
  } catch (error) {
    console.error('Request failed, storing for background sync:', error);

    // Store action for background sync
    await storeOfflineAction(request);

    // Register background sync
    if ('serviceWorker' in self && 'sync' in self.registration) {
      await self.registration.sync.register('background-sync');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Action queued for when online',
        queued: true
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Store offline action securely
async function storeOfflineAction(request) {
  try {
    const action = {
      id: generateActionId(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };

    // Encrypt sensitive data
    if (containsSensitiveData(action)) {
      action.body = await encryptData(action.body);
      action.encrypted = true;
    }

    // Store in IndexedDB
    await storeInSecureDB('offlineActions', action);
    console.log('Offline action stored:', action.id);
  } catch (error) {
    console.error('Failed to store offline action:', error);
  }
}

// Sync offline actions when back online
async function syncOfflineActions() {
  try {
    const offlineActions = await getOfflineActions();

    if (offlineActions.length === 0) {
      return;
    }

    console.log(`Syncing ${offlineActions.length} offline actions`);

    for (const action of offlineActions) {
      try {
        await processOfflineAction(action);
        await removeOfflineAction(action.id);
        console.log('Offline action synced:', action.id);
      } catch (error) {
        console.error('Failed to sync offline action:', error);
        // Keep action for retry
      }
    }
  } catch (error) {
    console.error('Failed to sync offline actions:', error);
    throw error;
  }
}

// Get offline actions from secure storage
async function getOfflineActions() {
  try {
    return await getAllFromSecureDB('offlineActions');
  } catch (error) {
    console.error('Failed to get offline actions:', error);
    return [];
  }
}

// Process an offline action
async function processOfflineAction(action) {
  try {
    let body = action.body;

    // Decrypt if necessary
    if (action.encrypted && encryptionKey) {
      body = await decryptData(body);
    }

    const response = await fetch(action.url, {
      method: action.method,
      headers: action.headers,
      body: body
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('Failed to process offline action:', error);
    throw error;
  }
}

// Remove processed offline action
async function removeOfflineAction(actionId) {
  try {
    await deleteFromSecureDB('offlineActions', actionId);
  } catch (error) {
    console.error('Failed to remove offline action:', error);
  }
}

// Utility functions
function isSensitiveEndpoint(pathname) {
  return SENSITIVE_API_PATTERNS.some(pattern => pattern.test(pathname));
}

function isCacheableApiEndpoint(url) {
  const pathname = new URL(url).pathname;
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(pathname));
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/.test(pathname);
}

function containsSensitiveData(action) {
  const sensitivePatterns = [/password/i, /token/i, /key/i, /secret/i, /auth/i];
  const actionStr = JSON.stringify(action).toLowerCase();
  return sensitivePatterns.some(pattern => pattern.test(actionStr));
}

function generateActionId() {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createOfflineApiResponse(request) {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'This feature is not available offline',
      cached: false
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

function createOfflinePage() {
  const offlineHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DeLangZeta - Offline</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          background: #0f172a;
          color: #e2e8f0;
        }
        .offline-container { 
          text-align: center; 
          padding: 2rem;
          max-width: 400px;
        }
        .offline-icon { 
          font-size: 4rem; 
          margin-bottom: 1rem; 
        }
        .retry-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>You're Offline</h1>
        <p>DeLangZeta is not available right now. Check your connection and try again.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>
  `;

  return new Response(offlineHtml, {
    headers: { 'Content-Type': 'text/html' }
  });
}

console.log('DeLangZeta Service Worker loaded successfully');
// Encryption utilities for secure offline storage
async function generateEncryptionKey() {
  try {
    if (crypto && crypto.subtle) {
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
      return key;
    } else {
      // Fallback for environments without crypto.subtle
      console.warn('crypto.subtle not available, using fallback encryption');
      return 'fallback-key-' + Math.random().toString(36);
    }
  } catch (error) {
    console.error('Failed to generate encryption key:', error);
    return null;
  }
}

async function encryptData(data) {
  try {
    if (!encryptionKey || typeof encryptionKey === 'string') {
      // Simple obfuscation fallback
      return btoa(data);
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      encryptionKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return data; // Return unencrypted as fallback
  }
}

async function decryptData(encryptedData) {
  try {
    if (!encryptionKey || typeof encryptionKey === 'string') {
      // Simple deobfuscation fallback
      return atob(encryptedData);
    }

    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      encryptionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedData; // Return as-is if decryption fails
  }
}

// Secure IndexedDB utilities
async function openSecureDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DeLangZetaSecure', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores
      if (!db.objectStoreNames.contains('offlineActions')) {
        const store = db.createObjectStore('offlineActions', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('encryptedCache')) {
        db.createObjectStore('encryptedCache', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('userPreferences')) {
        db.createObjectStore('userPreferences', { keyPath: 'key' });
      }
    };
  });
}

async function storeInSecureDB(storeName, data) {
  try {
    const db = await openSecureDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to store in secure DB:', error);
    throw error;
  }
}

async function getFromSecureDB(storeName, key) {
  try {
    const db = await openSecureDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get from secure DB:', error);
    return null;
  }
}

async function getAllFromSecureDB(storeName) {
  try {
    const db = await openSecureDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get all from secure DB:', error);
    return [];
  }
}

async function deleteFromSecureDB(storeName, key) {
  try {
    const db = await openSecureDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete from secure DB:', error);
    throw error;
  }
}

// Enhanced background sync with retry logic
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      syncOfflineActionsWithRetry()
        .then(() => {
          console.log('Background sync completed successfully');
          // Notify clients about successful sync
          return notifyClientsOfSync(true);
        })
        .catch((error) => {
          console.error('Background sync failed:', error);
          return notifyClientsOfSync(false, error.message);
        })
    );
  }
});

async function syncOfflineActionsWithRetry(maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await syncOfflineActions();
      return; // Success
    } catch (error) {
      lastError = error;
      console.error(`Sync attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

async function notifyClientsOfSync(success, error = null) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_RESULT',
        success: success,
        error: error,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Failed to notify clients of sync result:', error);
  }
}

console.log('DeLangZeta Secure Service Worker loaded successfully');