output "sites" {
  value = { for k, d in aws_cloudfront_distribution.site : k => {
    distribution_id = d.id
    arn             = d.arn
    domain_name     = d.domain_name
    hosted_zone_id  = d.hosted_zone_id
    default_url     = "https://${d.domain_name}"
    bucket          = aws_s3_bucket.site[k].bucket
  } }
}
