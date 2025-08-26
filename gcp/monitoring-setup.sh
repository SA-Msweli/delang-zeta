#!/bin/bash

# DeLangZeta Storage Monitoring and Alerting Setup
# This script sets up comprehensive monitoring for the storage infrastructure

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"delang-zeta"}
ALERT_EMAIL=${ALERT_EMAIL:-"admin@delang-zeta.com"}
ENVIRONMENT=${ENVIRONMENT:-"prod"}

echo "Setting up monitoring and alerting for DeLangZeta storage..."
echo "Project ID: $PROJECT_ID"
echo "Alert Email: $ALERT_EMAIL"
echo "Environment: $ENVIRONMENT"

# Create notification channel
echo "Creating notification channel..."
NOTIFICATION_CHANNEL=$(gcloud alpha monitoring channels create \
    --display-name="DeLangZeta Storage Alerts ($ENVIRONMENT)" \
    --type=email \
    --channel-labels=email_address=$ALERT_EMAIL \
    --project=$PROJECT_ID \
    --format="value(name)")

echo "Created notification channel: $NOTIFICATION_CHANNEL"

# Create alerting policies
echo "Creating alerting policies..."

# 1. Unauthorized access attempts
cat > /tmp/unauthorized-access-policy.yaml << EOF
displayName: "Storage Unauthorized Access ($ENVIRONMENT)"
documentation:
  content: "Alert when unauthorized access attempts are detected on storage buckets"
conditions:
  - displayName: "Unauthorized access attempts"
    conditionThreshold:
      filter: 'resource.type="gcs_bucket" AND log_name="projects/$PROJECT_ID/logs/cloudaudit.googleapis.com%2Fdata_access" AND protoPayload.authenticationInfo.principalEmail=""'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0
      duration: 60s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - $NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: 86400s
severity: ERROR
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/unauthorized-access-policy.yaml --project=$PROJECT_ID

# 2. Large file uploads (>100MB)
cat > /tmp/large-uploads-policy.yaml << EOF
displayName: "Large File Uploads ($ENVIRONMENT)"
documentation:
  content: "Alert when files larger than 100MB are uploaded"
conditions:
  - displayName: "Large file uploads"
    conditionThreshold:
      filter: 'resource.type="gcs_bucket" AND protoPayload.methodName="storage.objects.create" AND protoPayload.request.object.size>104857600'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 5
      duration: 300s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - $NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: 86400s
severity: WARNING
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/large-uploads-policy.yaml --project=$PROJECT_ID

# 3. High error rate in Cloud Functions
cat > /tmp/function-errors-policy.yaml << EOF
displayName: "Storage Function Errors ($ENVIRONMENT)"
documentation:
  content: "Alert when storage Cloud Functions have high error rates"
conditions:
  - displayName: "Function error rate"
    conditionThreshold:
      filter: 'resource.type="cloud_function" AND resource.labels.function_name=~"storage-.*" AND severity>=ERROR'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 10
      duration: 300s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - $NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: 86400s
severity: ERROR
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/function-errors-policy.yaml --project=$PROJECT_ID

# 4. Storage bucket quota usage
cat > /tmp/storage-quota-policy.yaml << EOF
displayName: "Storage Quota Usage ($ENVIRONMENT)"
documentation:
  content: "Alert when storage usage exceeds 80% of quota"
conditions:
  - displayName: "High storage usage"
    conditionThreshold:
      filter: 'resource.type="gcs_bucket" AND metric.type="storage.googleapis.com/storage/total_bytes"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 858993459200  # 800GB in bytes
      duration: 300s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_MEAN
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - $NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: 86400s
severity: WARNING
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/storage-quota-policy.yaml --project=$PROJECT_ID

# 5. Failed file operations
cat > /tmp/failed-operations-policy.yaml << EOF
displayName: "Failed Storage Operations ($ENVIRONMENT)"
documentation:
  content: "Alert when storage operations fail frequently"
conditions:
  - displayName: "Failed operations"
    conditionThreshold:
      filter: 'resource.type="gcs_bucket" AND protoPayload.@type="type.googleapis.com/google.cloud.audit.AuditLog" AND protoPayload.status.code!=0'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 20
      duration: 300s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_SUM
notificationChannels:
  - $NOTIFICATION_CHANNEL
alertStrategy:
  autoClose: 86400s
severity: WARNING
EOF

gcloud alpha monitoring policies create --policy-from-file=/tmp/failed-operations-policy.yaml --project=$PROJECT_ID

# Create custom dashboards
echo "Creating monitoring dashboard..."

cat > /tmp/storage-dashboard.json << EOF
{
  "displayName": "DeLangZeta Storage Dashboard ($ENVIRONMENT)",
  "mosaicLayout": {
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Storage Bucket Usage",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"gcs_bucket\" AND metric.type=\"storage.googleapis.com/storage/total_bytes\"",
                    "aggregation": {
                      "alignmentPeriod": "300s",
                      "perSeriesAligner": "ALIGN_MEAN",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Bytes",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "widget": {
          "title": "File Upload Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"gcs_bucket\" AND protoPayload.methodName=\"storage.objects.create\"",
                    "aggregation": {
                      "alignmentPeriod": "300s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Uploads/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "yPos": 4,
        "widget": {
          "title": "Cloud Function Invocations",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_function\" AND resource.labels.function_name=~\"storage-.*\" AND metric.type=\"cloudfunctions.googleapis.com/function/executions\"",
                    "aggregation": {
                      "alignmentPeriod": "300s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Invocations/sec",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "xPos": 6,
        "yPos": 4,
        "widget": {
          "title": "Function Error Rate",
          "xyChart": {
            "dataSets": [
              {
                "timeSeriesQuery": {
                  "timeSeriesFilter": {
                    "filter": "resource.type=\"cloud_function\" AND resource.labels.function_name=~\"storage-.*\" AND severity>=ERROR",
                    "aggregation": {
                      "alignmentPeriod": "300s",
                      "perSeriesAligner": "ALIGN_RATE",
                      "crossSeriesReducer": "REDUCE_SUM"
                    }
                  }
                },
                "plotType": "LINE"
              }
            ],
            "timeshiftDuration": "0s",
            "yAxis": {
              "label": "Errors/sec",
              "scale": "LINEAR"
            }
          }
        }
      }
    ]
  }
}
EOF

gcloud monitoring dashboards create --config-from-file=/tmp/storage-dashboard.json --project=$PROJECT_ID

# Set up log sinks for long-term storage
echo "Setting up log sinks..."

# Create log sink for audit logs
gcloud logging sinks create delang-storage-audit-sink \
    storage.googleapis.com/delang-zeta-audit-logs \
    --log-filter='resource.type="gcs_bucket" AND protoPayload.@type="type.googleapis.com/google.cloud.audit.AuditLog"' \
    --project=$PROJECT_ID || true

# Create log sink for function logs
gcloud logging sinks create delang-function-logs-sink \
    storage.googleapis.com/delang-zeta-audit-logs \
    --log-filter='resource.type="cloud_function" AND resource.labels.function_name=~"storage-.*"' \
    --project=$PROJECT_ID || true

# Clean up temporary files
rm -f /tmp/*-policy.yaml /tmp/storage-dashboard.json

echo ""
echo "✅ Monitoring and alerting setup completed successfully!"
echo ""
echo "📊 Configuration Summary:"
echo "  Notification Channel: $NOTIFICATION_CHANNEL"
echo "  Alert Email: $ALERT_EMAIL"
echo "  Environment: $ENVIRONMENT"
echo ""
echo "🚨 Alerting Policies Created:"
echo "  ✓ Unauthorized access attempts"
echo "  ✓ Large file uploads (>100MB)"
echo "  ✓ Storage function errors"
echo "  ✓ Storage quota usage (>800GB)"
echo "  ✓ Failed storage operations"
echo ""
echo "📈 Dashboard Created:"
echo "  ✓ DeLangZeta Storage Dashboard"
echo ""
echo "📝 Log Sinks Created:"
echo "  ✓ Storage audit logs sink"
echo "  ✓ Function logs sink"
echo ""
echo "Next steps:"
echo "1. View dashboards in Google Cloud Console > Monitoring"
echo "2. Test alerting by triggering test conditions"
echo "3. Customize alert thresholds based on usage patterns"
echo "4. Set up additional notification channels if needed"