locals {
  cache_disabled     = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed CachingDisabled
  all_viewer_no_host = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed AllViewer (forwards the viewer Host, Authorization, cookies, query). The name is historical: the apps must see the PUBLIC host (OIDC discovery URLs, signed-request host binding), Caddy routes on X-Kx-Service only.
  custom             = var.enable_custom_domains
}

resource "aws_cloudfront_response_headers_policy" "noindex" {
  count = var.noindex ? 1 : 0
  name  = "${var.name_prefix}-api-noindex"
  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      value    = "noindex, nofollow"
      override = true
    }
  }
}

# Optional shared WAF (CloudFront scope lives in us-east-1): AWS managed common rules + a per-IP rate limit.
resource "aws_wafv2_web_acl" "this" {
  provider    = aws.us_east_1
  count       = var.waf_enabled ? 1 : 0
  name        = "${var.name_prefix}-edge"
  scope       = "CLOUDFRONT"
  description = "Edge protection for ${var.name_prefix}"
  default_action {
    allow {}
  }
  rule {
    name     = "rate-limit"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }
  rule {
    name     = "aws-common"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-edge"
    sampled_requests_enabled   = true
  }
  tags = var.tags
}

resource "aws_cloudfront_distribution" "this" {
  for_each        = var.services
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.name_prefix} ${each.key}"
  price_class     = var.price_class
  http_version    = "http2and3"
  aliases         = local.custom ? [each.value.fqdn] : []
  web_acl_id      = var.waf_enabled ? aws_wafv2_web_acl.this[0].arn : null

  dynamic "origin" {
    for_each = { "o0" = var.origin_domains[0] }
    content {
      origin_id   = origin.key
      domain_name = origin.value
      custom_origin_config {
        http_port                = var.origin_port
        https_port               = 443
        origin_protocol_policy   = "http-only" # TLS ends at the CDN; see README risk R2 (VPC origin / origin TLS hardening)
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_read_timeout      = 60
        origin_keepalive_timeout = 30
      }
      custom_header {
        name  = "X-Origin-Secret"
        value = var.origin_secret
      }
      custom_header {
        name  = "X-Kx-Service"
        value = each.key
      }
    }
  }

  default_cache_behavior {
    target_origin_id           = "o0"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = local.cache_disabled
    origin_request_policy_id   = local.all_viewer_no_host
    response_headers_policy_id = var.noindex ? aws_cloudfront_response_headers_policy.noindex[0].id : null
    compress                   = true
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.custom ? null : true
    acm_certificate_arn            = local.custom ? var.certificate_arns[each.value.certificate_key] : null
    ssl_support_method             = local.custom ? "sni-only" : null
    minimum_protocol_version       = local.custom ? "TLSv1.2_2021" : null
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-${each.key}", Service = each.key })
}
