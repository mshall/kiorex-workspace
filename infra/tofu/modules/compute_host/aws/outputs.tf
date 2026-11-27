output "instance_ids" { value = aws_instance.host[*].id }
output "primary_instance_id" { value = aws_instance.host[0].id }
output "primary_availability_zone" { value = aws_instance.host[0].availability_zone }
output "origin_domains" {
  description = "DNS names the CDN uses as origin (one per host)."
  value       = aws_eip.host[*].public_dns
}
output "origin_port" { value = var.origin_port }
output "security_group_id" { value = aws_security_group.host.id }
output "role_name" { value = aws_iam_role.host.name }
output "role_arn" { value = aws_iam_role.host.arn }
output "deploy_bucket" { value = aws_s3_bucket.deploy.bucket }
output "deploy_bucket_arn" { value = aws_s3_bucket.deploy.arn }
output "deploy_document" { value = aws_ssm_document.deploy.name }
output "public_ips" { value = aws_eip.host[*].public_ip }
