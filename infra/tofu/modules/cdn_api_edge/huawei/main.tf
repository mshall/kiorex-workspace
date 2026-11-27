# UNVERIFIED AT RUNTIME. Huawei CDN needs a domain you own: a CDN domain cannot exist without a custom host name. With
# enable_custom_domains = false NO CDN is created and the APIs are reachable only through the host Elastic IP on the allowed CIDRs.
resource "huaweicloud_cdn_domain" "this" {
  for_each     = var.enable_custom_domains ? var.services : {}
  name         = each.value.fqdn
  type         = "web"
  service_area = "outside_mainland_china" # confirm the service area that covers Egypt with Huawei before the first apply
  tags         = var.tags

  sources {
    origin      = var.origin_domains[0]
    origin_type = "ipaddr"
    active      = 1
    http_port   = var.origin_port
    https_port  = 443
  }

  configs {
    origin_protocol = "http"
    ipv6_enable     = true

    https_settings {
      https_enabled      = true
      certificate_source = 2 # SCM certificate bought or imported by the founder (key never in state)
      scm_certificate_id = var.certificate_arns[each.value.certificate_key]
      http2_enabled      = true
      tls_version        = "TLSv1.2,TLSv1.3"
    }
    retrieval_request_header {
      action = "set"
      name   = "X-Origin-Secret"
      value  = var.origin_secret
    }
    retrieval_request_header {
      action = "set"
      name   = "X-Kx-Service"
      value  = each.key
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
