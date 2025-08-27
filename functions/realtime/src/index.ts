import { functions } from '@google-cloud/functions-framework';
import express from 'express';
import cors from 'cors';
import { authenticateJWT, optionalAuth, AuthRequest } from './middleware/auth';
import { applyRateLimit } from './middleware/rateLimiter';
import { realtimeSyncService } from './services/realtimeSync';
import { blockchainListenerService } from './services/blockchainListener';
import { notificationService } from './services/notificationService';
import { SyncRequest, RealtimeEvent } from './types';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://delang-zeta.web.app'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(applyRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'delang-zeta-realtime'
  });
});

// Sync user data endpoint
app.post('/sync', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const syncRequest: SyncRequest = {
      collections: req.body.collections || ['tasks', 'submissions', 'user_profiles'],
      lastSyncTimestamp: req.body.lastSyncTimestamp ? new Date(req.body.lastSyncTimestamp) : undefined,
      userId: req.user!.userId
    };

    const syncResponse = await realtimeSyncService.syncUserData(syncRequest);

    res.json({
      success: true,
      data: syncResponse
    });
  } catch (error: any) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync data',
      message: error.message
    });
  }
});

// Setup realtime listeners endpoint
app.post('/listeners/setup', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const collections = req.body.collections || [
      'tasks',
      'user_submissions',
      'user_validations',
      'user_rewards',
      'user_notifications'
    ];

    await realtimeSyncService.setupRealtimeListeners(req.user!.userId, collections);

    res.json({
      success: true,
      message: 'Realtime listeners setup successfully',
      collections
    });
  } catch (error: any) {
    console.error('Setup listeners error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup listeners',
      message: error.message
    });
  }
});

// Publish custom event endpoint (for testing and admin use)
app.post('/events/publish', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const event: RealtimeEvent = {
      id: req.body.id || `custom_${Date.now()}`,
      type: req.body.type,
      userId: req.body.userId || req.user!.userId,
      taskId: req.body.taskId,
      submissionId: req.body.submissionId,
      data: req.body.data,
      timestamp: new Date(),
      priority: req.body.priority || 'medium'
    };

    await realtimeSyncService.publishEvent(event);

    res.json({
      success: true,
      message: 'Event published successfully',
      eventId: event.id
    });
  } catch (error: any) {
    console.error('Publish event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish event',
      message: error.message
    });
  }
});

// Get blockchain event history
app.get('/blockchain/events', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const eventType = req.query.eventType as string;
    const fromBlock = req.query.fromBlock ? parseInt(req.query.fromBlock as string) : undefined;
    const toBlock = req.query.toBlock ? parseInt(req.query.toBlock as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const events = await blockchainListenerService.getEventHistory(
      eventType,
      fromBlock,
      toBlock,
      Math.min(limit, 1000) // Cap at 1000
    );

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error: any) {
    console.error('Get blockchain events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blockchain events',
      message: error.message
    });
  }
});

// Notification preferences endpoints
app.get('/notifications/preferences', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const preferences = await notificationService.getUserNotificationPreferences(req.user!.userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error: any) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification preferences',
      message: error.message
    });
  }
});

app.put('/notifications/preferences', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    await notificationService.updateNotificationPreferences(req.user!.userId, req.body);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error: any) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
      message: error.message
    });
  }
});

// Device token management
app.post('/notifications/device-token', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { token, deviceInfo } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Device token is required'
      });
    }

    await notificationService.registerDeviceToken(req.user!.userId, token, deviceInfo);

    res.json({
      success: true,
      message: 'Device token registered successfully'
    });
  } catch (error: any) {
    console.error('Register device token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device token',
      message: error.message
    });
  }
});

app.delete('/notifications/device-token', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Device token is required'
      });
    }

    await notificationService.unregisterDeviceToken(req.user!.userId, token);

    res.json({
      success: true,
      message: 'Device token unregistered successfully'
    });
  } catch (error: any) {
    console.error('Unregister device token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unregister device token',
      message: error.message
    });
  }
});

// Get notification history
app.get('/notifications/history', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const notifications = await notificationService.getNotificationHistory(
      req.user!.userId,
      Math.min(limit, 100), // Cap at 100
      offset
    );

    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    });
  } catch (error: any) {
    console.error('Get notification history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification history',
      message: error.message
    });
  }
});

// Mark notification as read
app.put('/notifications/:notificationId/read', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;

    await notificationService.markNotificationAsRead(req.user!.userId, notificationId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
});

// Send test notification (for testing)
app.post('/notifications/test', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const success = await notificationService.sendPushNotification({
      userId: req.user!.userId,
      title: 'Test Notification',
      body: 'This is a test notification from DeLangZeta',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      tag: 'test'
    });

    res.json({
      success: true,
      message: success ? 'Test notification sent successfully' : 'Failed to send test notification',
      delivered: success
    });
  } catch (error: any) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Initialize services
async function initializeServices() {
  try {
    console.log('Initializing realtime services...');

    await realtimeSyncService.initialize();
    await blockchainListenerService.initialize();

    // Start blockchain listeners
    await blockchainListenerService.startListening();

    console.log('Realtime services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Initialize on startup
initializeServices();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await blockchainListenerService.stopListening();
  await realtimeSyncService.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await blockchainListenerService.stopListening();
  await realtimeSyncService.cleanup();
  process.exit(0);
});

// Export the Express app for Cloud Functions
functions.http('realtimeApi', app);

export { app };