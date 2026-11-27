output "secret_names" { value = { for k, v in huaweicloud_csms_secret.this : k => v.name } }
output "secret_arns" { value = { for k, v in huaweicloud_csms_secret.this : k => v.id } }
output "prefix" { value = var.secrets_prefix }
