import { Firestore } from '@google-cloud/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { AlertRule, Alert, SecurityEvent } from '../types';
import { metricsService } from './metricsService';

export class AlertingService {
  private firestore: Firestore;
  private pubsub: PubSub;
  private activeAlerts: Map<string, Alert> = new Map();

  constructor() {
    this.firestore = new Firestore();
    this.pubsub = new PubSub();
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const alertRule: AlertRule = {
        ...rule,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.firestore.collection('alert_rules').doc(alertRule.id).set(alertRule);

      console.log(`Created alert rule: ${alertRule.name}`);
      return alertRule.id;
    } catch (error) {
      console.error('Failed to create alert rule:', error);
      throw error;
    }
  }

  /**
   * Update an existing alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      await this.firestore.collection('alert_rules').doc(ruleId).update({
        ...updates,
        updatedAt: new Date()
      });

      console.log(`Updated alert rule: ${ruleId}`);
    } catch (error) {
      console.error('Failed to update alert rule:', error);
      throw error;
    }
  }  /**

   * Delete an alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      await this.firestore.collection('alert_rules').doc(ruleId).delete();
      console.log(`Deleted alert rule: ${ruleId}`);
    } catch (error) {
      console.error('Failed to delete alert rule:', error);
      throw error;
    }
  }

  /**
   * Get all alert rules
   */
  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const snapshot = await this.firestore.collection('alert_rules').get();
      const rules: AlertRule[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        rules.push({
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as AlertRule);
      });

      return rules;
    } catch (error) {
      console.error('Failed to get alert rules:', error);
      return [];
    }
  }

  /**
   * Evaluate all alert rules
   */
  async evaluateAlertRules(): Promise<void> {
    try {
      const rules = await this.getAlertRules();
      const enabledRules = rules.filter(rule => rule.enabled);

      console.log(`Evaluating ${enabledRules.length} alert rules`);

      for (const rule of enabledRules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      console.error('Failed to evaluate alert rules:', error);
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - rule.duration * 1000);

      // Get metric values for the rule duration
      const metricValues = await metricsService.getMetricValues(
        rule.metric,
        startTime,
        now,
        rule.labels
      );

      if (metricValues.length === 0) {
        console.log(`No data for metric: ${rule.metric}`);
        return;
      }

      // Get the latest value
      const latestValue = metricValues[metricValues.length - 1].value;
      const isTriggered = this.evaluateCondition(latestValue, rule.condition, rule.threshold);

      const existingAlert = this.activeAlerts.get(rule.id);

      if (isTriggered && !existingAlert) {
        // Fire new alert
        await this.fireAlert(rule, latestValue);
      } else if (!isTriggered && existingAlert && existingAlert.status === 'firing') {
        // Resolve existing alert
        await this.resolveAlert(existingAlert);
      }
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error);
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Fire a new alert
   */
  private async fireAlert(rule: AlertRule, currentValue: number): Promise<void> {
    try {
      const alert: Alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        ruleName: rule.name,
        metric: rule.metric,
        currentValue,
        threshold: rule.threshold,
        condition: rule.condition,
        severity: rule.severity,
        status: 'firing',
        startTime: new Date(),
        description: `${rule.name}: ${rule.metric} is ${currentValue} (threshold: ${rule.threshold})`,
        labels: rule.labels
      };

      // Store alert
      await this.firestore.collection('alerts').doc(alert.id).set(alert);

      // Add to active alerts
      this.activeAlerts.set(rule.id, alert);

      // Send notifications
      await this.sendAlertNotifications(alert, rule.channels);

      console.log(`Fired alert: ${alert.id} for rule: ${rule.name}`);
    } catch (error) {
      console.error('Failed to fire alert:', error);
    }
  }

  /**
   * Resolve an existing alert
   */
  private async resolveAlert(alert: Alert): Promise<void> {
    try {
      const resolvedAlert = {
        ...alert,
        status: 'resolved' as const,
        endTime: new Date()
      };

      // Update alert in database
      await this.firestore.collection('alerts').doc(alert.id).update({
        status: 'resolved',
        endTime: new Date()
      });

      // Remove from active alerts
      this.activeAlerts.delete(alert.ruleId);

      // Send resolution notification
      await this.sendResolutionNotification(resolvedAlert);

      console.log(`Resolved alert: ${alert.id}`);
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert, channels: string[]): Promise<void> {
    try {
      const message = {
        type: 'alert',
        alert,
        timestamp: new Date().toISOString()
      };

      // Publish to Pub/Sub for notification processing
      const topic = this.pubsub.topic('delang-zeta-alerts');
      await topic.publishMessage({
        data: Buffer.from(JSON.stringify(message)),
        attributes: {
          alertId: alert.id,
          severity: alert.severity,
          channels: channels.join(',')
        }
      });

      console.log(`Sent alert notifications for: ${alert.id}`);
    } catch (error) {
      console.error('Failed to send alert notifications:', error);
    }
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(alert: Alert): Promise<void> {
    try {
      const message = {
        type: 'resolution',
        alert,
        timestamp: new Date().toISOString()
      };

      const topic = this.pubsub.topic('delang-zeta-alerts');
      await topic.publishMessage({
        data: Buffer.from(JSON.stringify(message)),
        attributes: {
          alertId: alert.id,
          type: 'resolution'
        }
      });

      console.log(`Sent resolution notification for: ${alert.id}`);
    } catch (error) {
      console.error('Failed to send resolution notification:', error);
    }
  }

  /**
   * Record security event
   */
  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        resolved: false
      };

      await this.firestore.collection('security_events').doc(securityEvent.id).set(securityEvent);

      // Create alert for high/critical security events
      if (securityEvent.severity === 'high' || securityEvent.severity === 'critical') {
        await this.createSecurityAlert(securityEvent);
      }

      console.log(`Recorded security event: ${securityEvent.type} (${securityEvent.severity})`);
    } catch (error) {
      console.error('Failed to record security event:', error);
      throw error;
    }
  }

  /**
   * Create alert for security event
   */
  private async createSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const alert: Alert = {
        id: `sec_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ruleId: 'security_rule',
        ruleName: 'Security Event Alert',
        metric: 'security_event',
        currentValue: 1,
        threshold: 0,
        condition: 'greater_than',
        severity: event.severity,
        status: 'firing',
        startTime: new Date(),
        description: `Security event detected: ${event.type} from ${event.source}`,
        labels: {
          event_type: event.type,
          source: event.source,
          user_id: event.userId || 'unknown'
        }
      };

      await this.firestore.collection('alerts').doc(alert.id).set(alert);
      await this.sendAlertNotifications(alert, ['email', 'slack']);

      console.log(`Created security alert: ${alert.id}`);
    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const snapshot = await this.firestore
        .collection('alerts')
        .where('status', '==', 'firing')
        .orderBy('startTime', 'desc')
        .get();

      const alerts: Alert[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        alerts.push({
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate()
        } as Alert);
      });

      return alerts;
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(limit = 100): Promise<Alert[]> {
    try {
      const snapshot = await this.firestore
        .collection('alerts')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();

      const alerts: Alert[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        alerts.push({
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime?.toDate()
        } as Alert);
      });

      return alerts;
    } catch (error) {
      console.error('Failed to get alert history:', error);
      return [];
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(limit = 100): Promise<SecurityEvent[]> {
    try {
      const snapshot = await this.firestore
        .collection('security_events')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const events: SecurityEvent[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        events.push({
          ...data,
          timestamp: data.timestamp.toDate(),
          resolvedAt: data.resolvedAt?.toDate()
        } as SecurityEvent);
      });

      return events;
    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }
}

export const alertingService = new AlertingService();