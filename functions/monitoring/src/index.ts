import { functions } from '@google-cloud/functions-framework';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { metricsService } from './services/metricsService';
import { alertingService } from './services/alertingService';
import { auditService } from './services/auditService';
import { MetricData, AlertRule, PerformanceMetrics, CostMetrics } from './types';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://delang-zeta.web.app'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Middleware to log API access
app.use(async (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;

    await auditService.logApiAccess(
      req.headers['x-user-id'] as string,
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      {
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      },
      req.ip,
      req.headers['user-agent']
    );
  });

  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await metricsService.getSystemHealth();
    res.json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'delang-zeta-monitoring',
      checks: health.checks
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'delang-zeta-monitoring',
      error: 'Health check failed'
    });
  }
});

// Metrics endpoints
app.post('/metrics', async (req, res) => {
  try {
    const metric: MetricData = req.body;
    await metricsService.recordMetric(metric);

    res.json({
      success: true,
      message: 'Metric recorded successfully'
    });
  } catch (error: any) {
    console.error('Record metric error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record metric',
      message: error.message
    });
  }
});

app.post('/metrics/performance', async (req, res) => {
  try {
    const metrics: PerformanceMetrics = req.body;
    await metricsService.recordPerformanceMetrics(metrics);

    res.json({
      success: true,
      message: 'Performance metrics recorded successfully'
    });
  } catch (error: any) {
    console.error('Record performance metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record performance metrics',
      message: error.message
    });
  }
});

app.post('/metrics/cost', async (req, res) => {
  try {
    const metrics: CostMetrics = req.body;
    await metricsService.recordCostMetrics(metrics);

    res.json({
      success: true,
      message: 'Cost metrics recorded successfully'
    });
  } catch (error: any) {
    console.error('Record cost metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record cost metrics',
      message: error.message
    });
  }
});

app.get('/metrics/:metricName', async (req, res) => {
  try {
    const { metricName } = req.params;
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      });
    }

    const values = await metricsService.getMetricValues(
      metricName,
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      success: true,
      data: values
    });
  } catch (error: any) {
    console.error('Get metric values error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metric values',
      message: error.message
    });
  }
});

app.get('/dashboard', async (req, res) => {
  try {
    const timeRange = req.query.timeRange as 'hour' | 'day' | 'week' | 'month' || 'day';
    const dashboard = await metricsService.getDashboardMetrics(timeRange);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error: any) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard metrics',
      message: error.message
    });
  }
});

// Alert rule endpoints
app.post('/alerts/rules', async (req, res) => {
  try {
    const rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'> = req.body;
    const ruleId = await alertingService.createAlertRule(rule);

    res.json({
      success: true,
      message: 'Alert rule created successfully',
      ruleId
    });
  } catch (error: any) {
    console.error('Create alert rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert rule',
      message: error.message
    });
  }
});

app.get('/alerts/rules', async (req, res) => {
  try {
    const rules = await alertingService.getAlertRules();

    res.json({
      success: true,
      data: rules
    });
  } catch (error: any) {
    console.error('Get alert rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert rules',
      message: error.message
    });
  }
});

app.put('/alerts/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    await alertingService.updateAlertRule(ruleId, updates);

    res.json({
      success: true,
      message: 'Alert rule updated successfully'
    });
  } catch (error: any) {
    console.error('Update alert rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule',
      message: error.message
    });
  }
});

app.delete('/alerts/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    await alertingService.deleteAlertRule(ruleId);

    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete alert rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule',
      message: error.message
    });
  }
});

// Alert endpoints
app.get('/alerts', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';

    const alerts = activeOnly
      ? await alertingService.getActiveAlerts()
      : await alertingService.getAlertHistory();

    res.json({
      success: true,
      data: alerts
    });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

app.post('/alerts/evaluate', async (req, res) => {
  try {
    await alertingService.evaluateAlertRules();

    res.json({
      success: true,
      message: 'Alert rules evaluated successfully'
    });
  } catch (error: any) {
    console.error('Evaluate alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate alert rules',
      message: error.message
    });
  }
});

// Security events endpoints
app.post('/security/events', async (req, res) => {
  try {
    const event = req.body;
    await alertingService.recordSecurityEvent(event);

    res.json({
      success: true,
      message: 'Security event recorded successfully'
    });
  } catch (error: any) {
    console.error('Record security event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record security event',
      message: error.message
    });
  }
});

app.get('/security/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await alertingService.getSecurityEvents(limit);

    res.json({
      success: true,
      data: events
    });
  } catch (error: any) {
    console.error('Get security events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security events',
      message: error.message
    });
  }
});

// Audit log endpoints
app.get('/audit/logs', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      resource: req.query.resource as string,
      startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      success: req.query.success ? req.query.success === 'true' : undefined
    };

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await auditService.getAuditLogs(filters, limit, offset);

    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit logs',
      message: error.message
    });
  }
});

app.get('/audit/statistics', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      });
    }

    const stats = await auditService.getAuditStatistics(
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Get audit statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit statistics',
      message: error.message
    });
  }
});

app.get('/audit/export', async (req, res) => {
  try {
    const { startTime, endTime, format } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      });
    }

    const exportData = await auditService.exportAuditLogs(
      new Date(startTime as string),
      new Date(endTime as string),
      format as 'json' | 'csv' || 'json'
    );

    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit-logs-${startTime}-${endTime}.${format || 'json'}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error: any) {
    console.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
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

// Schedule periodic tasks
if (process.env.NODE_ENV !== 'test') {
  // Evaluate alert rules every minute
  cron.schedule('* * * * *', async () => {
    try {
      await alertingService.evaluateAlertRules();
    } catch (error) {
      console.error('Scheduled alert evaluation failed:', error);
    }
  });

  // Cleanup old data every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await metricsService.cleanupOldMetrics(90); // 90 days retention
      await auditService.cleanupOldLogs(365); // 1 year retention
      console.log('Daily cleanup completed');
    } catch (error) {
      console.error('Daily cleanup failed:', error);
    }
  });

  console.log('Monitoring service scheduled tasks initialized');
}

// Export the Express app for Cloud Functions
functions.http('monitoringApi', app);

export { app };