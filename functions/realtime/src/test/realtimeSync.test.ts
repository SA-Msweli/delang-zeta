import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeSyncService } from '../services/realtimeSync';
import { RealtimeEvent, SyncRequest } from '../types';

// Mock dependencies
vi.mock('@google-cloud/firestore', () => ({
  Firestore: vi.fn(() => global.mockFirestore)
}));

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: vi.fn(() => global.mockPubSub)
}));

vi.mock('../config', () => ({
  configManager: {
    getConfig: () => Promise.resolve({
      pubsubTopicName: 'test-topic',
      firestoreProjectId: 'test-project'
    })
  }
}));

describe('RealtimeSyncService', () => {
  let service: RealtimeSyncService;

  beforeEach(() => {
    service = new RealtimeSyncService();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('publishEvent', () => {
    it('should publish event successfully', async () => {
      await service.initialize();

      const event: RealtimeEvent = {
        id: 'test-event-1',
        type: 'task_update',
        userId: 'user123',
        taskId: 'task456',
        data: { action: 'created' },
        timestamp: new Date(),
        priority: 'medium'
      };

      await expect(service.publishEvent(event)).resolves.not.toThrow();
    });

    it('should handle publish errors gracefully', async () => {
      await service.initialize();

      // Mock publish failure
      global.mockPubSub.topic = () => ({
        publishMessage: () => Promise.reject(new Error('Publish failed'))
      });

      const event: RealtimeEvent = {
        id: 'test-event-2',
        type: 'task_update',
        userId: 'user123',
        data: {},
        timestamp: new Date(),
        priority: 'low'
      };

      await expect(service.publishEvent(event)).rejects.toThrow('Publish failed');
    });
  });

  describe('syncUserData', () => {
    it('should sync user data successfully', async () => {
      const request: SyncRequest = {
        collections: ['tasks', 'submissions'],
        userId: 'user123',
        lastSyncTimestamp: new Date(Date.now() - 3600000) // 1 hour ago
      };

      const response = await service.syncUserData(request);

      expect(response).toHaveProperty('updates');
      expect(response).toHaveProperty('deletions');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('hasMore');
      expect(Array.isArray(response.updates)).toBe(true);
      expect(Array.isArray(response.deletions)).toBe(true);
    });

    it('should handle sync errors gracefully', async () => {
      // Mock Firestore error
      global.mockFirestore.collection = () => {
        throw new Error('Firestore error');
      };

      const request: SyncRequest = {
        collections: ['tasks'],
        userId: 'user123'
      };

      await expect(service.syncUserData(request)).rejects.toThrow('Firestore error');
    });
  });

  describe('setupRealtimeListeners', () => {
    it('should setup listeners successfully', async () => {
      const collections = ['tasks', 'submissions'];
      const userId = 'user123';

      await expect(service.setupRealtimeListeners(userId, collections)).resolves.not.toThrow();
    });
  });
});