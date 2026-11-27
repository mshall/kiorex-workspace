output "distribution_id" { value = aws_cloudfront_distribution.clinic.id }
output "distribution_domain" { value = aws_cloudfront_distribution.clinic.domain_name }
output "fqdn" { value = var.fqdn }
output "nat_gateway_id" { value = try(aws_nat_gateway.egress[0].id, null) }
output "nat_instance_id" { value = try(aws_instance.nat[0].id, null) }
output "nat_instance_public_ip" { value = try(aws_eip.nat_instance[0].public_ip, null) }
