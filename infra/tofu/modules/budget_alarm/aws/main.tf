resource "aws_budgets_budget" "monthly" {
  name         = "${var.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "cost_filter" {
    for_each = var.scope == "tag" ? [1] : []
    content {
      name   = "TagKeyValue"
      values = [format("user:EnvTag%s%s", "$", var.env_tag)] # the filter syntax is user:<TagKey>$<TagValue>
    }
  }

  dynamic "notification" {
    for_each = toset([for t in var.thresholds_percent : tostring(t)])
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = tonumber(notification.value)
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.emails
    }
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.emails
  }
  tags = var.tags
}
