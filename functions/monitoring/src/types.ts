export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
  unit?: string;
  description?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // in seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: string[]; // notification channels
  labels?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved';
  startTime: Date;
  endTime?: Date;
  description: string;
  labels?: Record<string, string>;
}

export interface SecurityEvent {
  id: string;
  type: 'authentication_failure' | 'rate_limit_exceeded' | 'suspicious_activity' | 'unauthorized_access' | 'data_breach_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface PerformanceMetrics {
  functionName: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  errorRate: number;
  requestCount: number;
  timestamp: Date;
}

export interface CostMetrics {
  service: string;
  cost: number;
  currency: string;
  period: 'hourly' | 'daily' | 'monthly';
  timestamp: Date;
  details?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface MonitoringConfig {
  projectId: string;
  alertingEnabled: boolean;
  securityMonitoringEnabled: boolean;
  performanceMonitoringEnabled: boolean;
  costMonitoringEnabled: boolean;
  auditLoggingEnabled: boolean;
  retentionDays: number;
  alertChannels: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
  thresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    costLimit: number;
  };
}