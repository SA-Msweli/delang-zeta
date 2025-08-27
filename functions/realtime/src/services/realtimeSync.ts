import { Firestore, DocumentSnapshot, QuerySnapshot } from '@google-cloud/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { configManager } from '../config';
import { RealtimeEvent, FirestoreDocument, SyncRequest, SyncResponse } from '../types';

export class RealtimeSyncService {
  private firestore: Firestore;
  private pubsub: PubSub;
  private topicName: string;

  constructor() {
    this.firestore = new Firestore();
    this.pubsub = new PubSub();
    this.topicName = 'delang-zeta-realtime-events';
  }

  async initialize(): Promise<void> {
    try {
      const config = await configManager.getConfig();
      this.topicName = config.pubsubTopicName;

      // Ensure topic exists
      const [topics] = await this.pubsub.getTopics();
      const topicExists = topics.some(topic => topic.name.endsWith(this.topicName));

      if (!topicExists) {
        await this.pubsub.createTopic(this.topicName);
        console.log(`Created Pub/Sub topic: ${this.topicName}`);
      }
    } catch (error) {
      console.error('Failed to initialize RealtimeSyncService:', error);
      throw error;
    }
  }

  async publishEvent(event: RealtimeEvent): Promise<void> {
    try {
      const topic = this.pubsub.topic(this.topicName);
      const messageData = Buffer.from(JSON.stringify(event));

      await topic.publishMessage({
        data: messageData,
        attributes: {
          eventType: event.type,
          userId: event.userId || '',
          taskId: event.taskId || '',
          priority: event.priority,
          timestamp: event.timestamp.toISOString()
        }
      });

      console.log(`Published event: ${event.type} for user: ${event.userId}`);
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  async syncUserData(request: SyncRequest): Promise<SyncResponse> {
    try {
      const updates: FirestoreDocument[] = [];
      const deletions: string[] = [];
      const syncTimestamp = new Date();

      // Sync each requested collection
      for (const collectionName of request.collections) {
        const collectionUpdates = await this.syncCollection(
          collectionName,
          request.userId,
          request.lastSyncTimestamp
        );
        updates.push(...collectionUpdates);
      }

      // Check for deletions (documents marked as deleted)
      if (request.lastSyncTimestamp) {
        const deletedDocs = await this.getDeletedDocuments(
          request.collections,
          request.userId,
          request.lastSyncTimestamp
        );
        deletions.push(...deletedDocs);
      }

      return {
        updates,
        deletions,
        timestamp: syncTimestamp,
        hasMore: updates.length >= 100 // Pagination indicator
      };
    } catch (error) {
      console.error('Failed to sync user data:', error);
      throw error;
    }
  }

  private async syncCollection(
    collectionName: string,
    userId: string,
    lastSyncTimestamp?: Date
  ): Promise<FirestoreDocument[]> {
    const documents: FirestoreDocument[] = [];

    try {
      let query = this.firestore.collection(collectionName);

      // Filter by user if applicable
      if (this.isUserSpecificCollection(collectionName)) {
        query = query.where('userId', '==', userId);
      } else if (this.isPublicCollection(collectionName)) {
        // Public collections don't need user filtering
      } else {
        // For other collections, check if user has access
        const hasAccess = await this.checkUserAccess(collectionName, userId);
        if (!hasAccess) {
          return documents;
        }
      }

      // Filter by timestamp if provided
      if (lastSyncTimestamp) {
        query = query.where('updatedAt', '>', lastSyncTimestamp);
      }

      // Limit results for performance
      query = query.limit(100);

      const snapshot = await query.get();

      snapshot.forEach((doc: DocumentSnapshot) => {
        const data = doc.data();
        if (data) {
          documents.push({
            id: doc.id,
            collection: collectionName,
            data,
            timestamp: data.updatedAt?.toDate() || new Date(),
            userId: data.userId
          });
        }
      });

      return documents;
    } catch (error) {
      console.error(`Failed to sync collection ${collectionName}:`, error);
      return documents;
    }
  }

  private async getDeletedDocuments(
    collections: string[],
    userId: string,
    lastSyncTimestamp: Date
  ): Promise<string[]> {
    const deletions: string[] = [];

    try {
      // Check the deletions log collection
      const deletionsQuery = this.firestore
        .collection('_deletions')
        .where('userId', '==', userId)
        .where('deletedAt', '>', lastSyncTimestamp)
        .where('collection', 'in', collections);

      const snapshot = await deletionsQuery.get();

      snapshot.forEach((doc: DocumentSnapshot) => {
        const data = doc.data();
        if (data) {
          deletions.push(`${data.collection}/${data.documentId}`);
        }
      });

      return deletions;
    } catch (error) {
      console.error('Failed to get deleted documents:', error);
      return deletions;
    }
  }

  private isUserSpecificCollection(collectionName: string): boolean {
    const userSpecificCollections = [
      'user_profiles',
      'user_submissions',
      'user_validations',
      'user_rewards',
      'user_notifications',
      'user_preferences'
    ];
    return userSpecificCollections.includes(collectionName);
  }

  private isPublicCollection(collectionName: string): boolean {
    const publicCollections = [
      'tasks',
      'marketplace_datasets',
      'governance_proposals',
      'platform_stats'
    ];
    return publicCollections.includes(collectionName);
  }

  private async checkUserAccess(collectionName: string, userId: string): Promise<boolean> {
    try {
      // Implement access control logic based on collection type
      switch (collectionName) {
        case 'validations':
          // Check if user is a validator
          const userProfile = await this.firestore
            .collection('user_profiles')
            .doc(userId)
            .get();

          const userData = userProfile.data();
          return userData?.isValidator === true;

        case 'admin_logs':
          // Check if user is admin
          const adminProfile = await this.firestore
            .collection('user_profiles')
            .doc(userId)
            .get();

          const adminData = adminProfile.data();
          return adminData?.role === 'admin';

        default:
          // Default to no access for unknown collections
          return false;
      }
    } catch (error) {
      console.error(`Failed to check access for collection ${collectionName}:`, error);
      return false;
    }
  }

  async setupRealtimeListeners(userId: string, collections: string[]): Promise<void> {
    try {
      for (const collectionName of collections) {
        await this.setupCollectionListener(collectionName, userId);
      }
    } catch (error) {
      console.error('Failed to setup realtime listeners:', error);
      throw error;
    }
  }

  private async setupCollectionListener(collectionName: string, userId: string): Promise<void> {
    try {
      let query = this.firestore.collection(collectionName);

      // Apply user-specific filtering
      if (this.isUserSpecificCollection(collectionName)) {
        query = query.where('userId', '==', userId);
      }

      // Set up the listener
      const unsubscribe = query.onSnapshot(
        (snapshot: QuerySnapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            const doc = change.doc;
            const data = doc.data();

            const event: RealtimeEvent = {
              id: `${collectionName}_${doc.id}_${Date.now()}`,
              type: this.getEventTypeFromCollection(collectionName),
              userId,
              data: {
                changeType: change.type,
                documentId: doc.id,
                collection: collectionName,
                data: change.type === 'removed' ? null : data
              },
              timestamp: new Date(),
              priority: this.getEventPriority(collectionName)
            };

            await this.publishEvent(event);
          });
        },
        (error) => {
          console.error(`Listener error for collection ${collectionName}:`, error);
        }
      );

      // Store unsubscribe function for cleanup
      // In a real implementation, you'd want to manage these listeners
      console.log(`Set up listener for collection: ${collectionName}`);
    } catch (error) {
      console.error(`Failed to setup listener for collection ${collectionName}:`, error);
    }
  }

  private getEventTypeFromCollection(collectionName: string): RealtimeEvent['type'] {
    switch (collectionName) {
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

  private getEventPriority(collectionName: string): RealtimeEvent['priority'] {
    switch (collectionName) {
      case 'user_rewards':
      case 'rewards':
        return 'high';
      case 'validations':
      case 'user_validations':
        return 'medium';
      default:
        return 'low';
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup resources if needed
    console.log('RealtimeSyncService cleanup completed');
  }
}

export const realtimeSyncService = new RealtimeSyncService();