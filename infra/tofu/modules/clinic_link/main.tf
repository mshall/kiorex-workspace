# Second, tofu-managed front door for the LIVE Clinic: https://<fqdn>. The legacy CloudFront host (CDK-managed) is only READ, never changed.
#
#   viewer -> this distribution -> default: the legacy distribution (SPA, same files and rewrite as the legacy host)
#                               -> /api/*, /marketplace/*: the Clinic App Runner service directly
#
# Why a second distribution: the legacy one and its web bucket policy belong to the Clinic CDK stack, which redeploys on every push to
# the Clinic main branch and would undo a manual alias or bucket-policy change. Chaining needs nothing from that stack.
locals {
  cache_disabled     = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed CachingDisabled
  all_viewer_no_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AWS managed AllViewerExceptHostHeader (the origin sees its own host)
}

data "aws_acm_certificate" "this" {
  provider    = aws.us_east_1
  domain      = var.zone_name # the environment certificate covers <zone> and *.<zone>
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_route53_zone" "this" {
  name         = var.zone_name
  private_zone = false
}

resource "aws_cloudfront_response_headers_policy" "noindex" {
  count = var.noindex ? 1 : 0
  name  = "${var.name_prefix}-clinic-noindex"
  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      value    = "noindex, nofollow"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "clinic" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.name_prefix} Clinic ${var.fqdn} (chains to the legacy Clinic distribution; App Runner for /api and /marketplace)"
  price_class     = var.price_class
  http_version    = "http2and3"
  aliases         = [var.fqdn]

  origin {
    origin_id   = "legacy-clinic-distribution"
    domain_name = var.legacy_distribution_domain
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }
  origin {
    origin_id   = "clinic-apprunner"
    domain_name = var.apprunner_domain
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id           = "legacy-clinic-distribution"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = local.cache_disabled
    origin_request_policy_id   = local.all_viewer_no_host
    response_headers_policy_id = var.noindex ? aws_cloudfront_response_headers_policy.noindex[0].id : null
    compress                   = true
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_paths
    content {
      path_pattern               = ordered_cache_behavior.value
      target_origin_id           = "clinic-apprunner"
      viewer_protocol_policy     = "redirect-to-https"
      allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods             = ["GET", "HEAD"]
      cache_policy_id            = local.cache_disabled
      origin_request_policy_id   = local.all_viewer_no_host
      response_headers_policy_id = var.noindex ? aws_cloudfront_response_headers_policy.noindex[0].id : null
      compress                   = true
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.this.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_route53_record" "a" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.fqdn
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.clinic.domain_name
    zone_id                = aws_cloudfront_distribution.clinic.hosted_zone_id
    evaluate_target_health = false
  }
}
resource "aws_route53_record" "aaaa" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.fqdn
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.clinic.domain_name
    zone_id                = aws_cloudfront_distribution.clinic.hosted_zone_id
    evaluate_target_health = false
  }
}

# ---------------------------------------------------------------- outbound internet for the Clinic API (App Runner VPC connector)
# The Clinic VPC has no NAT and its App Runner connector ENIs live in PUBLIC subnets without public addresses, so the API cannot reach
# anything outside the VPC and its endpoints (Passport discovery and token exchange, the Kiorex API, webhooks). A NAT gateway in a new
# small subnet (secondary CIDR: the primary /16 is fully used) becomes the default route of the two public route tables.
# The two default routes belong to the Clinic CDK stack: they are IMPORTED into this state (see the README), then updated in place from the
# internet gateway to the NAT gateway. Roll back = point them at the internet gateway again (tofu destroy -target of this module does it).
data "aws_vpc" "clinic" {
  count = var.enable_egress ? 1 : 0
  tags  = { Name = var.clinic_vpc_name }
}
data "aws_internet_gateway" "clinic" {
  count = var.enable_egress ? 1 : 0
  filter {
    name   = "attachment.vpc-id"
    values = [data.aws_vpc.clinic[0].id]
  }
}
data "aws_route_table" "public" {
  for_each = var.enable_egress ? toset(["1", "2"]) : toset([])
  tags     = { Name = "${var.clinic_vpc_name}/PublicSubnet${each.key}" }
}

resource "aws_vpc_ipv4_cidr_block_association" "egress" {
  count      = var.enable_egress ? 1 : 0
  vpc_id     = data.aws_vpc.clinic[0].id
  cidr_block = var.egress_cidr
}
resource "aws_subnet" "egress" {
  count                   = var.enable_egress ? 1 : 0
  vpc_id                  = data.aws_vpc.clinic[0].id
  cidr_block              = var.egress_cidr
  availability_zone       = var.egress_az
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.name_prefix}-clinic-nat" }
  depends_on              = [aws_vpc_ipv4_cidr_block_association.egress]
}
resource "aws_route_table" "egress" {
  count  = var.enable_egress ? 1 : 0
  vpc_id = data.aws_vpc.clinic[0].id
  tags   = { Name = "${var.name_prefix}-clinic-nat" }
}
resource "aws_route" "egress_igw" {
  count                  = var.enable_egress ? 1 : 0
  route_table_id         = aws_route_table.egress[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = data.aws_internet_gateway.clinic[0].id
}
resource "aws_route_table_association" "egress" {
  count          = var.enable_egress ? 1 : 0
  subnet_id      = aws_subnet.egress[0].id
  route_table_id = aws_route_table.egress[0].id
}
resource "aws_eip" "egress" {
  count  = var.enable_egress ? 1 : 0
  domain = "vpc"
  tags   = { Name = "${var.name_prefix}-clinic-nat" }
}
resource "aws_nat_gateway" "egress" {
  count         = var.enable_egress ? 1 : 0
  allocation_id = aws_eip.egress[0].id
  subnet_id     = aws_subnet.egress[0].id
  tags          = { Name = "${var.name_prefix}-clinic-nat" }
  depends_on    = [aws_route.egress_igw]
}

# Import first: tofu import 'module.clinic_link[0].aws_route.public_default["1"]' <route table id>_0.0.0.0/0   (same for "2")
resource "aws_route" "public_default" {
  for_each               = var.enable_egress ? toset(["1", "2"]) : toset([])
  route_table_id         = data.aws_route_table.public[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.egress[0].id
}
