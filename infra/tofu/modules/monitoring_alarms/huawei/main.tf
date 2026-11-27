# UNVERIFIED AT RUNTIME. SMN email topic + a CES CPU alarm per host. Backup freshness and CDN 5xx alarms are not provided on Huawei
# (no custom-metric push from the host yet): watch the CBR vault and CDN console, or extend this module (README risk).
resource "huaweicloud_smn_topic" "alerts" {
  name = "${var.name_prefix}-alerts"
  tags = var.tags
}
resource "huaweicloud_smn_subscription" "email" {
  for_each  = toset(var.emails)
  topic_urn = huaweicloud_smn_topic.alerts.topic_urn
  protocol  = "email"
  endpoint  = each.value
}
resource "huaweicloud_ces_alarmrule" "cpu" {
  for_each             = { for i, id in var.instance_ids : tostring(i) => id }
  alarm_name           = "${var.name_prefix}-host-${each.key}-cpu-high"
  alarm_action_enabled = true
  alarm_level          = 2
  metric {
    namespace = "SYS.ECS"
  }
  condition {
    metric_name         = "cpu_util"
    period              = 300
    filter              = "average"
    comparison_operator = ">"
    value               = var.cpu_threshold_percent
    unit                = "%"
    count               = 3
  }
  resources {
    dimensions {
      name  = "instance_id"
      value = each.value
    }
  }
  alarm_actions {
    type              = "notification"
    notification_list = [huaweicloud_smn_topic.alerts.topic_urn]
  }
}
