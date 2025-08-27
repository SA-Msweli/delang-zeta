import { Firestore } from '@google-cloud/firestore';
import { configManager } from '../config';
import { PushNotification, NotificationPreferences, RealtimeEvent } from '../types';

// Mock FCM for now - in production, use Firebase Admin SDK
interface FCMMessage {
  to?: string;
  registration_ids?: string[];
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
  };
  data?: Record<string, any>;
  webpush?: {
    headers?: Record<string, string>;
    notification?: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      tag?: string;
      requireInteraction?: boolean;
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
    };
  };
}

export class NotificationService {
  private firestore: Firestore;

  constructor() {
    this.firestore = new Firestore();
  }

  async sendPushNotification(notification: PushNotification): Promise<boolean> {
    try {
      // Get user's notification preferences
      const preferences = await this.getUserNotificationPreferences(notification.userId);

      if (!preferences.enablePushNotifications) {
        console.log(`Push notifications disabled for user: ${notification.userId}`);
        return false;
      }

      // Get user's device tokens
      const deviceTokens = await this.getUserDeviceTokens(notification.userId);

      if (deviceTokens.length === 0) {
        console.log(`No device tokens found for user: ${notification.userId}`);
        return false;
      }

      const config = await configManager.getConfig();

      // Prepare FCM message
      const fcmMessage: FCMMessage = {
        registration_ids: deviceTokens,
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icons/icon-192x192.png',
          badge: notification.badge || '/icons/badge-72x72.png',
          tag: notification.tag || 'delang-zeta'
        },
        data: {
          ...notification.data,
          userId: notification.userId,
          timestamp: new Date().toISOString()
        },
        webpush: {
          headers: {
            'TTL': '86400' // 24 hours
          },
          notification: {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || '/icons/icon-192x192.png',
            badge: notification.badge || '/icons/badge-72x72.png',
            tag: notification.tag || 'delang-zeta',
            requireInteraction: notification.requireInteraction || false,
            actions: this.getNotificationActions(notification)
          }
        }
      };

      // Send notification (mock implementation)
      const success = await this.sendFCMMessage(fcmMessage, config.notificationConfig.fcmServerKey);

      if (success) {
        // Store notification in database
        await this.storeNotification(notification);
        console.log(`Push notification sent to user: ${notification.userId}`);
      }

      return success;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  async sendBulkNotifications(notifications: PushNotification[]): Promise<number> {
    let successCount = 0;

    // Process notifications in batches to avoid overwhelming the service
    const batchSize = 100;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      const promises = batch.map(notification => this.sendPushNotification(notification));
      const results = await Promise.allSettled(promises);

      successCount += results.filter(result =>
        result.status === 'fulfilled' && result.value === true
      ).length;
    }

    console.log(`Sent ${successCount}/${notifications.length} bulk notifications`);
    return successCount;
  }

  async processRealtimeEventForNotifications(event: RealtimeEvent): Promise<void> {
    try {
      const notifications = await this.createNotificationsFromEvent(event);

      if (notifications.length > 0) {
        await this.sendBulkNotifications(notifications);
      }
    } catch (error) {
      console.error('Failed to process realtime event for notifications:', error);
    }
  }

  private async createNotificationsFromEvent(event: RealtimeEvent): Promise<PushNotification[]> {
    const notifications: PushNotification[] = [];

    try {
      switch (event.type) {
        case 'task_update':
          if (event.data.action === 'created') {
            // Notify all users about new task
            const interestedUsers = await this.getUsersInterestedInTasks();

            for (const userId of interestedUsers) {
              notifications.push({
                userId,
                title: 'New Task Available',
                body: `A new language data task has been created with ${event.data.reward} reward`,
                data: {
                  type: 'task_created',
                  taskId: event.taskId,
                  reward: event.data.reward
                },
                tag: 'task_created'
              });
            }
          }
          break;

        case 'submission_update':
          if (event.userId && event.data.action === 'submitted') {
            notifications.push({
              userId: event.userId,
              title: 'Submission Received',
              body: 'Your data submission has been received and is being processed',
              data: {
                type: 'submission_received',
                submissionId: event.submissionId
              },
              tag: 'submission_update'
            });
          }
          break;

        case 'validation_update':
          if (event.userId && event.data.action === 'verification_complete') {
            const approved = event.data.approved;
            notifications.push({
              userId: event.userId,
              title: approved ? 'Submission Approved!' : 'Submission Needs Revision',
              body: approved
                ? `Your submission scored ${event.data.finalScore}/100 and has been approved`
                : `Your submission scored ${event.data.finalScore}/100 and needs revision`,
              data: {
                type: 'verification_complete',
                submissionId: event.submissionId,
                approved,
                score: event.data.finalScore
              },
              tag: 'validation_update',
              requireInteraction: true
            });
          }
          break;

        case 'reward_distributed':
          if (event.userId) {
            notifications.push({
              userId: event.userId,
              title: 'Reward Received!',
              body: `You've received ${event.data.amount} ${event.data.token} for your contribution`,
              data: {
                type: 'reward_received',
                amount: event.data.amount,
                token: event.data.token,
                transactionHash: event.data.transactionHash
              },
              tag: 'reward_received',
              requireInteraction: true
            });
          }
          break;

        case 'blockchain_event':
          // Handle blockchain-specific notifications
          if (event.data.action === 'crosschain_operation_complete') {
            // Find users affected by this operation
            const affectedUsers = await this.getUsersAffectedByOperation(event.data.operationId);

            for (const userId of affectedUsers) {
              notifications.push({
                userId,
                title: event.data.success ? 'Transaction Completed' : 'Transaction Failed',
                body: event.data.success
                  ? 'Your cross-chain transaction has been completed successfully'
                  : 'Your cross-chain transaction failed. Please try again.',
                data: {
                  type: 'crosschain_update',
                  operationId: event.data.operationId,
                  success: event.data.success,
                  transactionHash: event.data.transactionHash
                },
                tag: 'blockchain_update'
              });
            }
          }
          break;
      }

      return notifications;
    } catch (error) {
      console.error('Failed to create notifications from event:', error);
      return [];
    }
  }

  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const doc = await this.firestore
        .collection('user_notification_preferences')
        .doc(userId)
        .get();

      if (doc.exists) {
        return doc.data() as NotificationPreferences;
      }

      // Return default preferences
      return {
        userId,
        enablePushNotifications: true,
        enableEmailNotifications: true,
        enableInAppNotifications: true,
        taskUpdates: true,
        validationUpdates: true,
        rewardNotifications: true,
        governanceUpdates: false,
        marketplaceUpdates: false,
        privacyLevel: 'private'
      };
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      // Return default preferences on error
      return {
        userId,
        enablePushNotifications: true,
        enableEmailNotifications: true,
        enableInAppNotifications: true,
        taskUpdates: true,
        validationUpdates: true,
        rewardNotifications: true,
        governanceUpdates: false,
        marketplaceUpdates: false,
        privacyLevel: 'private'
      };
    }
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      await this.firestore
        .collection('user_notification_preferences')
        .doc(userId)
        .set({
          ...preferences,
          userId,
          updatedAt: new Date()
        }, { merge: true });

      console.log(`Updated notification preferences for user: ${userId}`);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  async registerDeviceToken(userId: string, token: string, deviceInfo?: any): Promise<void> {
    try {
      await this.firestore
        .collection('user_device_tokens')
        .doc(`${userId}_${token}`)
        .set({
          userId,
          token,
          deviceInfo: deviceInfo || {},
          registeredAt: new Date(),
          lastUsed: new Date(),
          active: true
        });

      console.log(`Registered device token for user: ${userId}`);
    } catch (error) {
      console.error('Failed to register device token:', error);
      throw error;
    }
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    try {
      await this.firestore
        .collection('user_device_tokens')
        .doc(`${userId}_${token}`)
        .update({
          active: false,
          unregisteredAt: new Date()
        });

      console.log(`Unregistered device token for user: ${userId}`);
    } catch (error) {
      console.error('Failed to unregister device token:', error);
      throw error;
    }
  }

  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    try {
      const snapshot = await this.firestore
        .collection('user_device_tokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();

      const tokens: string[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        tokens.push(data.token);
      });

      return tokens;
    } catch (error) {
      console.error('Failed to get user device tokens:', error);
      return [];
    }
  }

  private async getUsersInterestedInTasks(): Promise<string[]> {
    try {
      const snapshot = await this.firestore
        .collection('user_notification_preferences')
        .where('taskUpdates', '==', true)
        .where('enablePushNotifications', '==', true)
        .limit(1000) // Limit to prevent overwhelming
        .get();

      const userIds: string[] = [];
      snapshot.forEach(doc => {
        userIds.push(doc.id);
      });

      return userIds;
    } catch (error) {
      console.error('Failed to get users interested in tasks:', error);
      return [];
    }
  }

  private async getUsersAffectedByOperation(operationId: string): Promise<string[]> {
    try {
      // This would typically query a cross-chain operations table
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Failed to get users affected by operation:', error);
      return [];
    }
  }

  private getNotificationActions(notification: PushNotification): Array<{ action: string; title: string; icon?: string }> {
    const actions: Array<{ action: string; title: string; icon?: string }> = [];

    if (notification.data?.type === 'task_created') {
      actions.push(
        { action: 'view_task', title: 'View Task', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      );
    } else if (notification.data?.type === 'reward_received') {
      actions.push(
        { action: 'view_rewards', title: 'View Rewards', icon: '/icons/rewards.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      );
    } else {
      actions.push(
        { action: 'open_app', title: 'Open App', icon: '/icons/open.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      );
    }

    return actions;
  }

  private async sendFCMMessage(message: FCMMessage, serverKey: string): Promise<boolean> {
    try {
      // Mock FCM implementation - in production, use Firebase Admin SDK
      console.log('Sending FCM message:', JSON.stringify(message, null, 2));

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate 90% success rate
      return Math.random() > 0.1;
    } catch (error) {
      console.error('Failed to send FCM message:', error);
      return false;
    }
  }

  private async storeNotification(notification: PushNotification): Promise<void> {
    try {
      await this.firestore
        .collection('user_notifications')
        .add({
          ...notification,
          sentAt: new Date(),
          read: false,
          delivered: true
        });
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  async getNotificationHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<any[]> {
    try {
      const snapshot = await this.firestore
        .collection('user_notifications')
        .where('userId', '==', userId)
        .orderBy('sentAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const notifications: any[] = [];
      snapshot.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return notifications;
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await this.firestore
        .collection('user_notifications')
        .doc(notificationId)
        .update({
          read: true,
          readAt: new Date()
        });

      console.log(`Marked notification as read: ${notificationId}`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();