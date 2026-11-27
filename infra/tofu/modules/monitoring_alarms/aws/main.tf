resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"
  tags = var.tags
}
resource "aws_sns_topic_subscription" "email" {
  for_each  = toset(var.emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value # each recipient must click the confirmation link once
}
# CloudFront metrics exist only in us-east-1, and an alarm can only notify a topic in its own region.
resource "aws_sns_topic" "alerts_global" {
  provider = aws.us_east_1
  name     = "${var.name_prefix}-alerts-edge"
  tags     = var.tags
}
resource "aws_sns_topic_subscription" "email_global" {
  provider  = aws.us_east_1
  for_each  = toset(var.emails)
  topic_arn = aws_sns_topic.alerts_global.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "status" {
  for_each            = { for i, id in var.instance_ids : tostring(i) => id }
  alarm_name          = "${var.name_prefix}-host-${each.key}-status-check"
  alarm_description   = "Host failed an EC2 status check; auto-recovery is attempted for system failures"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = each.value }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "recover" {
  for_each            = { for i, id in var.instance_ids : tostring(i) => id }
  alarm_name          = "${var.name_prefix}-host-${each.key}-auto-recover"
  alarm_description   = "Recover the instance on the same host-side failure (keeps its volumes and Elastic IP)"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  dimensions          = { InstanceId = each.value }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = ["arn:aws:automate:${var.region}:ec2:recover", aws_sns_topic.alerts.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "cpu" {
  for_each            = { for i, id in var.instance_ids : tostring(i) => id }
  alarm_name          = "${var.name_prefix}-host-${each.key}-cpu-high"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = each.value }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = var.cpu_threshold_percent
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "credits" {
  for_each            = { for i, id in var.instance_ids : tostring(i) => id }
  alarm_name          = "${var.name_prefix}-host-${each.key}-cpu-credits-low"
  alarm_description   = "Burstable instance is running out of CPU credits; move to a larger size"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  dimensions          = { InstanceId = each.value }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 3
  threshold           = 30
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "backup" {
  count               = var.backup_alarm_enabled ? 1 : 0
  alarm_name          = "${var.name_prefix}-backup-missing-or-failed"
  alarm_description   = "No successful daily database dump in the last 24 h (the host reports Kiorex/<env> BackupOk after each run)"
  namespace           = "Kiorex/${var.env}"
  metric_name         = "BackupOk"
  dimensions          = { Env = var.env }
  statistic           = "Minimum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "cdn_5xx" {
  provider            = aws.us_east_1
  for_each            = var.cdn_distribution_ids
  alarm_name          = "${var.name_prefix}-cdn-${each.key}-5xx"
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  dimensions          = { DistributionId = each.value, Region = "Global" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts_global.arn]
  tags                = var.tags
}
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count               = var.managed_db_identifier != "" ? 1 : 0
  alarm_name          = "${var.name_prefix}-rds-free-storage-low"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = var.managed_db_identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2147483648
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  tags                = var.tags
}
