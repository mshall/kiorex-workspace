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
  count  = var.enable_egress && var.egress_gateway_enabled ? 1 : 0
  domain = "vpc"
  tags   = { Name = "${var.name_prefix}-clinic-nat" }
}
resource "aws_nat_gateway" "egress" {
  count         = var.enable_egress && var.egress_gateway_enabled ? 1 : 0
  allocation_id = aws_eip.egress[0].id
  subnet_id     = aws_subnet.egress[0].id
  tags          = { Name = "${var.name_prefix}-clinic-nat" }
  depends_on    = [aws_route.egress_igw]
}

# ---------------------------------------------------------------- cheaper egress: a NAT instance (t4g.nano) instead of the managed gateway
# About 7 USD per month instead of about 36 USD. Trade-off: one instance (no managed HA), bandwidth bounded by the instance size (t4g.nano
# bursts to 5 Gbps, baseline roughly 32 Mbps, far above the Clinic API's Passport and platform calls), recovery by the EC2 alarms below
# (the same instance id, interface, private address and Elastic IP come back; minutes, not seconds). Plain Amazon Linux 2023 with nftables
# masquerade (no third-party image). Rollback: egress_gateway_enabled = true, egress_route_via = "gateway", apply; then egress_instance_enabled = false.
data "aws_ssm_parameter" "nat_ami" {
  count = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}
data "aws_region" "current" {}

resource "aws_security_group" "nat" {
  count       = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  name        = "${var.name_prefix}-clinic-nat-instance"
  description = "NAT instance for the Clinic API egress: accepts the Clinic VPC, sends anywhere"
  vpc_id      = data.aws_vpc.clinic[0].id
  ingress {
    description = "Clinic VPC (App Runner connector interfaces)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [data.aws_vpc.clinic[0].cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name_prefix}-clinic-nat-instance" }
}

resource "aws_iam_role" "nat" {
  count = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  name  = "${var.name_prefix}-clinic-nat-instance"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "nat_ssm" {
  count      = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  role       = aws_iam_role.nat[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "nat" {
  count = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  name  = "${var.name_prefix}-clinic-nat-instance"
  role  = aws_iam_role.nat[0].name
}

resource "aws_instance" "nat" {
  count                  = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  ami                    = data.aws_ssm_parameter.nat_ami[0].value
  instance_type          = var.egress_instance_type
  subnet_id              = aws_subnet.egress[0].id
  vpc_security_group_ids = [aws_security_group.nat[0].id]
  iam_instance_profile   = aws_iam_instance_profile.nat[0].name
  source_dest_check      = false
  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }
  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }
  user_data_replace_on_change = false
  user_data                   = <<-EOT
    #!/bin/bash
    set -eux
    # 0.5 GB of memory: dnf is killed while it loads the repository metadata unless there is swap.
    if [ ! -f /swapfile ]; then
      dd if=/dev/zero of=/swapfile bs=1M count=1024
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo "/swapfile none swap sw 0 0" >> /etc/fstab
    fi
    dnf install -y nftables
    echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/90-kx-nat.conf
    sysctl --system
    IFACE=$(ip -o -4 route show to default | awk '{print $5}' | head -1)
    mkdir -p /etc/nftables
    cat > /etc/nftables/kx-nat.nft <<NFT
    table ip kx_nat {
      chain postrouting {
        type nat hook postrouting priority 100; policy accept;
        ip saddr ${data.aws_vpc.clinic[0].cidr_block} oifname "$IFACE" masquerade
      }
    }
    NFT
    grep -q kx-nat.nft /etc/sysconfig/nftables.conf || echo 'include "/etc/nftables/kx-nat.nft"' >> /etc/sysconfig/nftables.conf
    systemctl enable --now nftables
  EOT
  tags                        = { Name = "${var.name_prefix}-clinic-nat-instance" }
  lifecycle {
    # A newer Amazon Linux image or an edited script must never replace the live egress by surprise.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "nat_instance" {
  count    = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  domain   = "vpc"
  instance = aws_instance.nat[0].id
  tags     = { Name = "${var.name_prefix}-clinic-nat-instance" }
}

# Auto-recovery: a failed host (system check) is recovered in place, a hung operating system (instance check) is rebooted.
resource "aws_cloudwatch_metric_alarm" "nat_system" {
  count               = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  alarm_name          = "${var.name_prefix}-clinic-nat-system-recover"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  dimensions          = { InstanceId = aws_instance.nat[0].id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = ["arn:aws:automate:${data.aws_region.current.name}:ec2:recover"]
  treat_missing_data  = "notBreaching"
}
resource "aws_cloudwatch_metric_alarm" "nat_instance" {
  count               = var.enable_egress && var.egress_instance_enabled ? 1 : 0
  alarm_name          = "${var.name_prefix}-clinic-nat-instance-reboot"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  dimensions          = { InstanceId = aws_instance.nat[0].id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = ["arn:aws:automate:${data.aws_region.current.name}:ec2:reboot"]
  treat_missing_data  = "notBreaching"
}

# Import first: tofu import 'module.clinic_link[0].aws_route.public_default["1"]' <route table id>_0.0.0.0/0   (same for "2")
resource "aws_route" "public_default" {
  for_each               = var.enable_egress ? toset(["1", "2"]) : toset([])
  route_table_id         = data.aws_route_table.public[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  # Exactly one target: the managed NAT gateway (egress_route_via = "gateway") or the NAT instance's network interface ("instance").
  nat_gateway_id       = var.egress_route_via == "gateway" ? aws_nat_gateway.egress[0].id : null
  network_interface_id = var.egress_route_via == "instance" ? aws_instance.nat[0].primary_network_interface_id : null

  lifecycle {
    precondition {
      condition     = (var.egress_route_via == "gateway" && var.egress_gateway_enabled) || (var.egress_route_via == "instance" && var.egress_instance_enabled)
      error_message = "egress_route_via must name an enabled egress (gateway needs egress_gateway_enabled, instance needs egress_instance_enabled)."
    }
  }
}
