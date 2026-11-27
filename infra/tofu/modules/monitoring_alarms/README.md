# monitoring_alarms

Alarms and one e-mail topic: host status and auto-recovery, CPU and CPU credits, missing or failed daily backup, CDN 5xx, managed database storage.

Same interface on both providers: `monitoring_alarms/aws` and `monitoring_alarms/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, env, region, emails, instance_ids, cdn_distribution_ids, backup_alarm_enabled, managed_db_identifier, cpu_threshold_percent

**Outputs:** topic_arn

**AWS:** SNS (two topics: eu region and us-east-1 for CloudFront metrics), CloudWatch alarms. Disk-space needs the CloudWatch agent (not installed, listed in risks).

**Huawei (validated with `tofu validate` only, never applied):** SMN topic + e-mail subscriptions + CES CPU alarm only.
