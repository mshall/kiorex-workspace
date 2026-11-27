# The Huawei Cloud provider has no budget resource (checked against huaweicloud ~> 1.70). Nothing is created; set the budget in the
# Cost Center console (Budgets) with the same limit and thresholds. The values are echoed so the runbook step is copy-paste.
resource "terraform_data" "manual_budget" {
  input = {
    name       = "${var.name_prefix}-monthly"
    limit_usd  = var.monthly_limit_usd
    thresholds = var.thresholds_percent
    emails     = var.emails
  }
}
