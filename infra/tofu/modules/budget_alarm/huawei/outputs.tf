output "budget_name" { value = terraform_data.manual_budget.input.name }
output "note" { value = "MANUAL STEP: create this budget in Huawei Cost Center (Budgets): limit ${var.monthly_limit_usd} USD per month, alerts at ${join(", ", [for t in var.thresholds_percent : "${t}%"])}." }
