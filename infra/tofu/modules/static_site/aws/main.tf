data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  custom     = var.enable_custom_domains
  with_api   = { for k, s in var.sites : k => s if s.api_service != "" }
}

resource "aws_s3_bucket" "site" {
  for_each = var.sites
  bucket   = "${var.name_prefix}-site-${replace(each.key, ".", "-")}-${local.account_id}"
  tags     = merge(var.tags, { Service = each.key })
}
resource "aws_s3_bucket_public_access_block" "site" {
  for_each                = var.sites
  bucket                  = aws_s3_bucket.site[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  for_each = var.sites
  bucket   = aws_s3_bucket.site[each.key].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_versioning" "site" {
  for_each = var.sites
  bucket   = aws_s3_bucket.site[each.key].id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_lifecycle_configuration" "site" {
  for_each = var.sites
  bucket   = aws_s3_bucket.site[each.key].id
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 14 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.name_prefix}-site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# SPA routing on the default behavior only: a path without a file extension serves /index.html. /api/* is a separate behavior and is untouched.
resource "aws_cloudfront_function" "spa" {
  name    = "${var.name_prefix}-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var r = event.request;
      if (r.uri.indexOf('.') === -1) { r.uri = '/index.html'; }
      return r;
    }
  JS
}

# Multi-page static sites (kiorly-site): /ar/clinics/ and /ar/clinics become /ar/clinics/index.html. The code is the file the site ships (single source).
locals {
  directory_sites = { for k, s in var.sites : k => s if s.rewrite == "directory" }
}
resource "aws_cloudfront_function" "directory" {
  count   = length(local.directory_sites) > 0 ? 1 : 0
  name    = "${var.name_prefix}-directory-index-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/../../../../../kiorex-account/apps/kiorly-site/deploy/cloudfront-index-rewrite.js")
}

# Same-origin Passport path for Kiorly Home: /idp/token becomes /token on the Passport origin. Only sites with idp_proxy get the behaviour.
locals {
  idp_sites = { for k, s in var.sites : k => s if s.idp_proxy }
}
resource "aws_cloudfront_function" "idp_strip" {
  count   = length(local.idp_sites) > 0 ? 1 : 0
  name    = "${var.name_prefix}-idp-prefix-strip"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var r = event.request;
      r.uri = r.uri.replace(/^\/idp(?=\/|$)/, '') || '/';
      return r;
    }
  JS
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name = "${var.name_prefix}-site"
  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      override                   = true
    }
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
  dynamic "custom_headers_config" {
    for_each = var.noindex ? [1] : []
    content {
      items {
        header   = "X-Robots-Tag"
        value    = "noindex, nofollow"
        override = true
      }
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  for_each            = var.sites
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} ${each.key}"
  default_root_object = "index.html"
  price_class         = var.price_class
  http_version        = "http2and3"
  aliases             = local.custom ? [each.value.fqdn] : []
  web_acl_id          = var.web_acl_arn

  origin {
    origin_id                = "s3"
    domain_name              = aws_s3_bucket.site[each.key].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  dynamic "origin" {
    for_each = each.value.api_service != "" ? { "api" = var.origin_domains[0] } : {}
    content {
      origin_id   = "api"
      domain_name = origin.value
      custom_origin_config {
        http_port                = var.origin_port
        https_port               = 443
        origin_protocol_policy   = "http-only"
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
        value = each.value.api_service
      }
    }
  }

  dynamic "origin" {
    for_each = each.value.idp_proxy ? { "idp" = var.origin_domains[0] } : {}
    content {
      origin_id   = "idp"
      domain_name = origin.value
      custom_origin_config {
        http_port                = var.origin_port
        https_port               = 443
        origin_protocol_policy   = "http-only"
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
        value = "kiorex.passport"
      }
    }
  }

  default_cache_behavior {
    target_origin_id           = "s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS managed CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
    compress                   = true
    function_association {
      event_type   = "viewer-request"
      function_arn = each.value.rewrite == "directory" ? aws_cloudfront_function.directory[0].arn : aws_cloudfront_function.spa.arn
    }
  }

  # Directory sites: a missing page answers the site's own 404 page (private S3 answers 403 for a missing key).
  dynamic "custom_error_response" {
    for_each = each.value.rewrite == "directory" ? toset([403, 404]) : toset([])
    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = "/404.html"
      error_caching_min_ttl = 60
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = each.value.api_service != "" ? toset(concat(["/api/*"], each.value.api_paths)) : toset([])
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = "api"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
      origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed AllViewer: the API sees the public host name
      compress                 = true
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = each.value.idp_proxy ? toset(["/idp/*"]) : toset([])
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = "idp"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
      origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed AllViewer
      compress                 = true
      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.idp_strip[0].arn
      }
    }
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

data "aws_iam_policy_document" "site" {
  for_each = var.sites
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site[each.key].arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site[each.key].arn]
    }
  }
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.site[each.key].arn, "${aws_s3_bucket.site[each.key].arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}
resource "aws_s3_bucket_policy" "site" {
  for_each = var.sites
  bucket   = aws_s3_bucket.site[each.key].id
  policy   = data.aws_iam_policy_document.site[each.key].json
}
