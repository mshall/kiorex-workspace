resource "aws_secretsmanager_secret" "this" {
  for_each                = toset(var.names)
  name                    = "${var.secrets_prefix}/${each.value}"
  description             = "${var.name_prefix} ${each.value} (values set outside OpenTofu)"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "edge" {
  count         = var.set_edge_secret ? 1 : 0
  secret_id     = aws_secretsmanager_secret.this["edge"].id
  secret_string = jsonencode({ origin_secret = var.edge_secret_value })
}
