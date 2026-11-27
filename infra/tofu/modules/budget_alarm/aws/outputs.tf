output "budget_name" { value = aws_budgets_budget.monthly.name }
output "note" { value = var.scope == "tag" ? "Tag-scoped: activate cost allocation tag EnvTag in Billing, otherwise the budget shows zero." : "Account-wide budget." }
