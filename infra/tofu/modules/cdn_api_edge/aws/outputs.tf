output "distributions" {
  value = { for k, d in aws_cloudfront_distribution.this : k => {
    distribution_id = d.id
    arn             = d.arn
    domain_name     = d.domain_name
    hosted_zone_id  = d.hosted_zone_id
    default_url     = "https://${d.domain_name}"
  } }
}
output "web_acl_arn" { value = var.waf_enabled ? aws_wafv2_web_acl.this[0].arn : null }
