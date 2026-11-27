output "certificate_arns" {
  description = "domain key => certificate ARN (validated when wait_for_validation is true)."
  value       = { for k, c in aws_acm_certificate.this : k => try(aws_acm_certificate_validation.this[k].certificate_arn, c.arn) }
}
