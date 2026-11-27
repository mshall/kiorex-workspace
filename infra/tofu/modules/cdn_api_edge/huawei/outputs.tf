output "distributions" {
  value = { for k, v in var.services : k => {
    distribution_id = try(huaweicloud_cdn_domain.this[k].id, "")
    arn             = try(huaweicloud_cdn_domain.this[k].id, "")
    domain_name     = try(huaweicloud_cdn_domain.this[k].cname, "")
    hosted_zone_id  = ""
    default_url     = try("https://${huaweicloud_cdn_domain.this[k].name}", "http://${var.origin_domains[0]}:${var.origin_port} (no CDN until custom domains are enabled)")
  } }
}
output "web_acl_arn" { value = null }
