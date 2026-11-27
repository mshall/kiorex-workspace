# UNVERIFIED AT RUNTIME. Static bundles on OBS behind Huawei CDN. DIFFERENCE FROM AWS (documented risk): the CDN can only read a PRIVATE
# OBS bucket with access keys, which would put keys in OpenTofu state. These buckets hold only public web assets (the compiled SPA
# bundle, no data), so they are public-read and the CDN fetches them anonymously. Never put anything private in these buckets.
resource "huaweicloud_obs_bucket" "site" {
  for_each      = var.sites
  bucket        = "${var.name_prefix}-site-${replace(each.key, ".", "-")}"
  acl           = "public-read"
  storage_class = "STANDARD"
  versioning    = true
  force_destroy = false
  tags          = merge(var.tags, { Service = each.key })
  website {
    index_document = "index.html"
    error_document = "index.html"
  }
}

resource "huaweicloud_cdn_domain" "site" {
  for_each     = var.enable_custom_domains ? var.sites : {}
  name         = each.value.fqdn
  type         = "web"
  service_area = "outside_mainland_china"
  tags         = var.tags

  sources {
    origin                  = huaweicloud_obs_bucket.site[each.key].bucket_domain_name
    origin_type             = "obs_bucket"
    active                  = 1
    obs_web_hosting_enabled = true
    obs_bucket_type         = "website"
  }

  configs {
    origin_protocol = "https"
    ipv6_enable     = true
    https_settings {
      https_enabled      = true
      certificate_source = 2
      scm_certificate_id = var.certificate_arns[each.value.certificate_key]
      http2_enabled      = true
      tls_version        = "TLSv1.2,TLSv1.3"
    }
    dynamic "flexible_origin" {
      for_each = each.value.api_service != "" ? [1] : []
      content {
        match_type    = "file_path"
        match_pattern = "/api/"
        priority      = 1
        back_sources {
          sources_type = "ipaddr"
          ip_or_domain = var.origin_domains[0]
          http_port    = var.origin_port
        }
      }
    }
    dynamic "http_response_header" {
      for_each = var.noindex ? [1] : []
      content {
        action = "set"
        name   = "X-Robots-Tag"
        value  = "noindex, nofollow"
      }
    }
  }
}
