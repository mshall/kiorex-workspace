# UNVERIFIED AT RUNTIME. Huawei Cloud DNS public zones; CDN hostnames are CNAME records (no alias records). A CNAME cannot sit at a zone
# apex: the environment apex host (for example test.kiorex.com) needs the apex handling described in RUNBOOK section 12.
resource "huaweicloud_dns_zone" "this" {
  for_each  = var.zones
  name      = "${each.value}."
  zone_type = "public"
  email     = "hostmaster@${each.value}"
  ttl       = 300
  tags      = var.tags
}

data "huaweicloud_dns_zone_nameservers" "this" {
  for_each = huaweicloud_dns_zone.this
  zone_id  = each.value.id
}

resource "huaweicloud_dns_recordset" "cdn" {
  for_each = { for k, r in var.cdn_records : k => r if r.fqdn != var.zones[r.zone_key] }
  zone_id  = huaweicloud_dns_zone.this[each.value.zone_key].id
  name     = "${each.value.fqdn}."
  type     = "CNAME"
  ttl      = 300
  records  = ["${each.value.target}."]
}
