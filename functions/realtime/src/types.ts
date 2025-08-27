export interface AuthenticatedRequest {
  userId: string;
  walletAddress: string;
  permissions: string[];
  token: string;
}

export interface RealtimeEvent {
  id: string;
  type: 'task_update' | 'submission_update' | 'validation_update' | 'reward_distributed' | 'blockchain_event';
  userId?: string;
  taskId?: string;
  submissionId?: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationPreferences {
  userId: string;
  enablePushNotifications: boolean;
  enableEmailNotifications: boolean;
  enableInAppNotifications: boolean;
  taskUpdates: boolean;
  validationUpdates: boolean;
  rewardNotifications: boolean;
  governanceUpdates: boolean;
  marketplaceUpdates: boolean;
  privacyLevel: 'public' | 'private' | 'anonymous';
}

export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export interface BlockchainEvent {
  eventType: string;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  data: any;
  timestamp: Date;
}

export interface FirestoreDocument {
  id: string;
  collection: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface SyncRequest {
  collections: string[];
  lastSyncTimestamp?: Date;
  userId: string;
}

export interface SyncResponse {
  updates: FirestoreDocument[];
  deletions: string[];
  timestamp: Date;
  hasMore: boolean;
}