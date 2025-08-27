// Secure offline storage utilities for PWA

export interface OfflineData {
  key: string;
  data: any;
  timestamp: number;
  encrypted?: boolean;
  expiresAt?: number;
}

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  method: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineStorageManager {
  private dbName = 'DeLangZetaOffline';
  private version = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initializeDB();
    }
  }

  // Initialize IndexedDB
  private async initializeDB(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('offlineData')) {
          const dataStore = db.createObjectStore('offlineData', { keyPath: 'key' });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
          dataStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('offlineActions')) {
          const actionsStore = db.createObjectStore('offlineActions', { keyPath: 'id' });
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionsStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'key' });
        }
      };
    });
  }

  // Store data offline with optional encryption
  async storeData(key: string, data: any, options: {
    encrypt?: boolean;
    expiresIn?: number; // milliseconds
  } = {}): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    const offlineData: OfflineData = {
      key,
      data: options.encrypt ? await this.encryptData(data) : data,
      timestamp: Date.now(),
      encrypted: options.encrypt,
      expiresAt: options.expiresIn ? Date.now() + options.expiresIn : undefined
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.put(offlineData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve data from offline storage
  async getData(key: string): Promise<any> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = store.get(key);

      request.onsuccess = async () => {
        const result = request.result as OfflineData;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if data has expired
        if (result.expiresAt && Date.now() > result.expiresAt) {
          await this.removeData(key);
          resolve(null);
          return;
        }

        // Decrypt if necessary
        const data = result.encrypted ? await this.decryptData(result.data) : result.data;
        resolve(data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Remove data from offline storage
  async removeData(key: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Store offline action for background sync
  async storeAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    if (!this.db) {
      await this.initializeDB();
    }

    const offlineAction: OfflineAction = {
      ...action,
      id: this.generateActionId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const request = store.put(offlineAction);

      request.onsuccess = () => resolve(offlineAction.id);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending offline actions
  async getPendingActions(): Promise<OfflineAction[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineActions'], 'readonly');
      const store = transaction.objectStore('offlineActions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove processed action
  async removeAction(actionId: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const request = store.delete(actionId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Update action retry count
  async updateActionRetryCount(actionId: string, retryCount: number): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
      const store = transaction.objectStore('offlineActions');
      const getRequest = store.get(actionId);

      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.retryCount = retryCount;
          const putRequest = store.put(action);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Action not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Clean up expired data
  async cleanupExpiredData(): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Store user preferences
  async storePreference(key: string, value: any): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPreferences'], 'readwrite');
      const store = transaction.objectStore('userPreferences');
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get user preference
  async getPreference(key: string): Promise<any> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['userPreferences'], 'readonly');
      const store = transaction.objectStore('userPreferences');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Simple encryption for sensitive data
  private async encryptData(data: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(data);
      // Simple base64 encoding (in production, use proper encryption)
      return btoa(jsonString);
    } catch (error) {
      console.error('Encryption failed:', error);
      return JSON.stringify(data);
    }
  }

  // Simple decryption for sensitive data
  private async decryptData(encryptedData: string): Promise<any> {
    try {
      // Simple base64 decoding (in production, use proper decryption)
      const jsonString = atob(encryptedData);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedData;
    }
  }

  // Generate unique action ID
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get storage usage statistics
  async getStorageStats(): Promise<{
    dataCount: number;
    actionsCount: number;
    preferencesCount: number;
    estimatedSize: number;
  }> {
    if (!this.db) {
      await this.initializeDB();
    }

    const transaction = this.db!.transaction(['offlineData', 'offlineActions', 'userPreferences'], 'readonly');

    const dataCount = await this.getStoreCount(transaction.objectStore('offlineData'));
    const actionsCount = await this.getStoreCount(transaction.objectStore('offlineActions'));
    const preferencesCount = await this.getStoreCount(transaction.objectStore('userPreferences'));

    return {
      dataCount,
      actionsCount,
      preferencesCount,
      estimatedSize: (dataCount + actionsCount + preferencesCount) * 1024 // Rough estimate
    };
  }

  private getStoreCount(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Create singleton instance
export const offlineStorage = new OfflineStorageManager();

// Utility functions
export const storeOfflineData = (key: string, data: any, options?: { encrypt?: boolean; expiresIn?: number }) =>
  offlineStorage.storeData(key, data, options);

export const getOfflineData = (key: string) =>
  offlineStorage.getData(key);

export const removeOfflineData = (key: string) =>
  offlineStorage.removeData(key);

export const storeOfflineAction = (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) =>
  offlineStorage.storeAction(action);

export const getPendingOfflineActions = () =>
  offlineStorage.getPendingActions();

export const removeOfflineAction = (actionId: string) =>
  offlineStorage.removeAction(actionId);

export const storeUserPreference = (key: string, value: any) =>
  offlineStorage.storePreference(key, value);

export const getUserPreference = (key: string) =>
  offlineStorage.getPreference(key);

export const cleanupExpiredOfflineData = () =>
  offlineStorage.cleanupExpiredData();

export const getOfflineStorageStats = () =>
  offlineStorage.getStorageStats();