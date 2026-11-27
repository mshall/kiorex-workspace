resource "aws_route53_zone" "this" {
  for_each = var.zones
  name     = each.value
  comment  = "${var.name_prefix} ${each.key}: delegated from the registrar by the founder (NS records), see outputs"
  tags     = var.tags
}

locals {
  alias_types = toset(["A", "AAAA"])
  alias_pairs = { for pair in setproduct(keys(var.cdn_records), tolist(local.alias_types)) : "${pair[0]}/${pair[1]}" => { rec = pair[0], type = pair[1] } }
}

resource "aws_route53_record" "cdn" {
  for_each = local.alias_pairs
  zone_id  = aws_route53_zone.this[var.cdn_records[each.value.rec].zone_key].zone_id
  name     = var.cdn_records[each.value.rec].fqdn
  type     = each.value.type
  alias {
    name                   = var.cdn_records[each.value.rec].target
    zone_id                = var.cdn_records[each.value.rec].alias_zone_id
    evaluate_target_health = false
  }
}
