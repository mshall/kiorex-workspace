output "distribution_id" { value = aws_cloudfront_distribution.clinic.id }
output "distribution_domain" { value = aws_cloudfront_distribution.clinic.domain_name }
output "fqdn" { value = var.fqdn }
output "nat_gateway_id" { value = try(aws_nat_gateway.egress[0].id, null) }
