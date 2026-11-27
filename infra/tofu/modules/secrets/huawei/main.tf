locals {
  base = replace(trimprefix(var.secrets_prefix, "/"), "/", "-") # CSMS names cannot contain "/"
}

resource "huaweicloud_csms_secret" "this" {
  for_each    = toset(var.names)
  name        = "${local.base}-${each.value}"
  description = "${var.name_prefix} ${each.value} (values set outside OpenTofu)"
  kms_key_id  = var.kms_key_id
  secret_text = each.value == "edge" && var.set_edge_secret ? jsonencode({ origin_secret = var.edge_secret_value }) : "{}"
  tags        = var.tags
  lifecycle {
    ignore_changes = [secret_text] # real values are put by the founder or the host after creation
  }
}
