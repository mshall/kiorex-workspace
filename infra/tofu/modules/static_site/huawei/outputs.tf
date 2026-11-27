output "sites" {
  value = { for k, v in var.sites : k => {
    distribution_id = try(huaweicloud_cdn_domain.site[k].id, "")
    arn             = try(huaweicloud_cdn_domain.site[k].id, "")
    domain_name     = try(huaweicloud_cdn_domain.site[k].cname, "")
    hosted_zone_id  = ""
    default_url     = try("https://${huaweicloud_cdn_domain.site[k].name}", "https://${huaweicloud_obs_bucket.site[k].bucket}.obs-website.${var.region}.myhuaweicloud.com")
    bucket          = huaweicloud_obs_bucket.site[k].bucket
  } }
}
