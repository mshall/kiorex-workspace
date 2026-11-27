output "secret_names" { value = { for k, v in aws_secretsmanager_secret.this : k => v.name } }
output "secret_arns" { value = { for k, v in aws_secretsmanager_secret.this : k => v.arn } }
output "prefix" { value = var.secrets_prefix }
