# CloudFront only accepts certificates from us-east-1, hence the aliased provider.
resource "aws_acm_certificate" "this" {
  provider                  = aws.us_east_1
  for_each                  = var.certificates
  domain_name               = each.value.primary
  subject_alternative_names = each.value.sans
  validation_method         = "DNS"
  tags                      = merge(var.tags, { Name = "${var.name_prefix}-${each.key}" })
  lifecycle { create_before_destroy = true }
}

locals {
  validation = merge([
    for k, c in aws_acm_certificate.this : {
      for o in c.domain_validation_options : "${k}/${o.domain_name}" => { key = k, name = o.resource_record_name, type = o.resource_record_type, value = o.resource_record_value }
    }
  ]...)
}

# The primary name and its wildcard produce the SAME validation record; allow_overwrite avoids a duplicate-record error.
resource "aws_route53_record" "validation" {
  for_each        = local.validation
  zone_id         = var.zone_ids[each.value.key]
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  provider                = aws.us_east_1
  for_each                = var.wait_for_validation ? aws_acm_certificate.this : {}
  certificate_arn         = each.value.arn
  validation_record_fqdns = [for k, v in local.validation : aws_route53_record.validation[k].fqdn if v.key == each.key]
}
