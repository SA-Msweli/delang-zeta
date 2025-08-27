import { Monitoring } from '@google-cloud/monitoring';
import { Firestore } from '@google-cloud/firestore';
import { MetricData, PerformanceMetrics, CostMetrics } from '../types';

export class MetricsService {
  private monitoring: Monitoring;
  private firestore: Firestore;
  private projectId: string;

  constructor() {
    this.monitoring = new Monitoring.MetricServiceClient();
    this.firestore = new Firestore();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'delang-zeta';
  }

  /**
   * Record a custom metric
   */
  async recordMetric(metric: MetricData): Promise<void> {
    try {
      const projectPath = this.monitoring.projectPath(this.projectId);

      // Create time series data
      const timeSeries = {
        metric: {
          type: `custom.googleapis.com/delang-zeta/${metric.name}`,
          labels: metric.labels || {}
        },
        resource: {
          type: 'global',
          labels: {
            project_id: this.projectId
          }
        },
        points: [{
          interval: {
            endTime: {
              seconds: Math.floor(metric.timestamp.getTime() / 1000)
            }
          },
          value: {
            doubleValue: metric.value
          }
        }]
      };

      // Write to Cloud Monitoring
      await this.monitoring.createTimeSeries({
        name: projectPath,
        timeSeries: [timeSeries]
      });

      // Also store in Firestore for historical analysis
      await this.firestore.collection('metrics').add({
        ...metric,
        projectId: this.projectId,
        createdAt: new Date()
      });

      console.log(`Recorded metric: ${metric.name} = ${metric.value}`);
    } catch (error) {
      console.error('Failed to record metric:', error);
      throw error;
    }
  }

  /**
   * Record performance metrics for a Cloud Function
   */
  async recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const baseLabels = {
        function_name: metrics.functionName,
        project_id: this.projectId
      };

      // Record multiple metrics
      await Promise.all([
        this.recordMetric({
          name: 'function_execution_time',
          value: metrics.executionTime,
          timestamp: metrics.timestamp,
          labels: baseLabels,
          unit: 'ms',
          description: 'Cloud Function execution time'
        }),
        this.recordMetric({
          name: 'function_memory_usage',
          value: metrics.memoryUsage,
          timestamp: metrics.timestamp,
          labels: baseLabels,
          unit: 'MB',
          description: 'Cloud Function memory usage'
        }),
        this.recordMetric({
          name: 'function_error_rate',
          value: metrics.errorRate,
          timestamp: metrics.timestamp,
          labels: baseLabels,
          unit: '%',
          description: 'Cloud Function error rate'
        }),
        this.recordMetric({
          name: 'function_request_count',
          value: metrics.requestCount,
          timestamp: metrics.timestamp,
          labels: baseLabels,
          unit: 'count',
          description: 'Cloud Function request count'
        })
      ]);

      // Store detailed performance data
      await this.firestore.collection('performance_metrics').add({
        ...metrics,
        projectId: this.projectId,
        createdAt: new Date()
      });

    } catch (error) {
      console.error('Failed to record performance metrics:', error);
      throw error;
    }
  }

  /**
   * Record cost metrics
   */
  async recordCostMetrics(metrics: CostMetrics): Promise<void> {
    try {
      await this.recordMetric({
        name: 'service_cost',
        value: metrics.cost,
        timestamp: metrics.timestamp,
        labels: {
          service: metrics.service,
          currency: metrics.currency,
          period: metrics.period,
          project_id: this.projectId
        },
        unit: metrics.currency,
        description: `Cost for ${metrics.service}`
      });

      // Store detailed cost data
      await this.firestore.collection('cost_metrics').add({
        ...metrics,
        projectId: this.projectId,
        createdAt: new Date()
      });

      console.log(`Recorded cost metric: ${metrics.service} = ${metrics.cost} ${metrics.currency}`);
    } catch (error) {
      console.error('Failed to record cost metrics:', error);
      throw error;
    }
  }

  /**
   * Get metric values for a time range
   */
  async getMetricValues(
    metricName: string,
    startTime: Date,
    endTime: Date,
    labels?: Record<string, string>
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    try {
      const projectPath = this.monitoring.projectPath(this.projectId);

      const filter = `metric.type="custom.googleapis.com/delang-zeta/${metricName}"`;
      const interval = {
        startTime: {
          seconds: Math.floor(startTime.getTime() / 1000)
        },
        endTime: {
          seconds: Math.floor(endTime.getTime() / 1000)
        }
      };

      const [timeSeries] = await this.monitoring.listTimeSeries({
        name: projectPath,
        filter,
        interval,
        view: 'FULL'
      });

      const values: Array<{ timestamp: Date; value: number }> = [];

      timeSeries.forEach(series => {
        series.points?.forEach(point => {
          if (point.interval?.endTime?.seconds && point.value?.doubleValue !== undefined) {
            values.push({
              timestamp: new Date(Number(point.interval.endTime.seconds) * 1000),
              value: point.value.doubleValue
            });
          }
        });
      });

      return values.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get metric values:', error);
      return [];
    }
  }

  /**
   * Get aggregated metrics for dashboard
   */
  async getDashboardMetrics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Get key metrics
      const [
        functionExecutionTimes,
        functionErrorRates,
        functionRequestCounts,
        costMetrics
      ] = await Promise.all([
        this.getMetricValues('function_execution_time', startTime, now),
        this.getMetricValues('function_error_rate', startTime, now),
        this.getMetricValues('function_request_count', startTime, now),
        this.getCostSummary(startTime, now)
      ]);

      // Calculate aggregations
      const avgExecutionTime = functionExecutionTimes.length > 0
        ? functionExecutionTimes.reduce((sum, m) => sum + m.value, 0) / functionExecutionTimes.length
        : 0;

      const avgErrorRate = functionErrorRates.length > 0
        ? functionErrorRates.reduce((sum, m) => sum + m.value, 0) / functionErrorRates.length
        : 0;

      const totalRequests = functionRequestCounts.reduce((sum, m) => sum + m.value, 0);

      return {
        timeRange,
        period: { startTime, endTime: now },
        performance: {
          avgExecutionTime: Math.round(avgExecutionTime * 100) / 100,
          avgErrorRate: Math.round(avgErrorRate * 100) / 100,
          totalRequests: Math.round(totalRequests)
        },
        costs: costMetrics,
        trends: {
          executionTime: functionExecutionTimes,
          errorRate: functionErrorRates,
          requestCount: functionRequestCounts
        }
      };
    } catch (error) {
      console.error('Failed to get dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get cost summary for a time period
   */
  private async getCostSummary(startTime: Date, endTime: Date): Promise<any> {
    try {
      const snapshot = await this.firestore
        .collection('cost_metrics')
        .where('timestamp', '>=', startTime)
        .where('timestamp', '<=', endTime)
        .get();

      const costsByService: Record<string, number> = {};
      let totalCost = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const service = data.service;
        const cost = data.cost || 0;

        costsByService[service] = (costsByService[service] || 0) + cost;
        totalCost += cost;
      });

      return {
        totalCost: Math.round(totalCost * 100) / 100,
        costsByService,
        currency: 'USD' // Assuming USD for now
      };
    } catch (error) {
      console.error('Failed to get cost summary:', error);
      return { totalCost: 0, costsByService: {}, currency: 'USD' };
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics(retentionDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const collections = ['metrics', 'performance_metrics', 'cost_metrics'];

      for (const collection of collections) {
        const snapshot = await this.firestore
          .collection(collection)
          .where('createdAt', '<', cutoffDate)
          .limit(500) // Process in batches
          .get();

        if (!snapshot.empty) {
          const batch = this.firestore.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });

          await batch.commit();
          console.log(`Cleaned up ${snapshot.size} old ${collection} records`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check Cloud Functions health
      const functionHealth = await this.checkCloudFunctionsHealth();
      checks.push(functionHealth);

      // Check Firestore health
      const firestoreHealth = await this.checkFirestoreHealth();
      checks.push(firestoreHealth);

      // Check monitoring service health
      const monitoringHealth = await this.checkMonitoringHealth();
      checks.push(monitoringHealth);

      // Determine overall status
      const failedChecks = checks.filter(check => check.status === 'fail').length;
      if (failedChecks > 0) {
        overallStatus = failedChecks >= checks.length / 2 ? 'unhealthy' : 'degraded';
      }

      return { status: overallStatus, checks };
    } catch (error) {
      console.error('Failed to get system health:', error);
      return {
        status: 'unhealthy',
        checks: [{ name: 'system', status: 'fail', message: 'Health check failed' }]
      };
    }
  }

  private async checkCloudFunctionsHealth(): Promise<{ name: string; status: 'pass' | 'fail'; message?: string }> {
    try {
      // Check recent error rates
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const errorRates = await this.getMetricValues('function_error_rate', oneHourAgo, now);
      const avgErrorRate = errorRates.length > 0
        ? errorRates.reduce((sum, m) => sum + m.value, 0) / errorRates.length
        : 0;

      if (avgErrorRate > 10) { // More than 10% error rate
        return {
          name: 'cloud_functions',
          status: 'fail',
          message: `High error rate: ${avgErrorRate.toFixed(2)}%`
        };
      }

      return { name: 'cloud_functions', status: 'pass' };
    } catch (error) {
      return {
        name: 'cloud_functions',
        status: 'fail',
        message: 'Unable to check function health'
      };
    }
  }

  private async checkFirestoreHealth(): Promise<{ name: string; status: 'pass' | 'fail'; message?: string }> {
    try {
      // Try to read from Firestore
      await this.firestore.collection('health_check').limit(1).get();
      return { name: 'firestore', status: 'pass' };
    } catch (error) {
      return {
        name: 'firestore',
        status: 'fail',
        message: 'Firestore connection failed'
      };
    }
  }

  private async checkMonitoringHealth(): Promise<{ name: string; status: 'pass' | 'fail'; message?: string }> {
    try {
      // Try to access monitoring API
      const projectPath = this.monitoring.projectPath(this.projectId);
      await this.monitoring.listMetricDescriptors({
        name: projectPath,
        pageSize: 1
      });

      return { name: 'monitoring', status: 'pass' };
    } catch (error) {
      return {
        name: 'monitoring',
        status: 'fail',
        message: 'Monitoring API connection failed'
      };
    }
  }
}

export const metricsService = new MetricsService();