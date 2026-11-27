output "instance_ids" { value = huaweicloud_compute_instance.host[*].id }
output "primary_instance_id" { value = huaweicloud_compute_instance.host[0].id }
output "primary_availability_zone" { value = huaweicloud_compute_instance.host[0].availability_zone }
output "origin_domains" {
  description = "DNS names the CDN uses as origin (one per host)."
  value       = huaweicloud_vpc_eip.host[*].address
}
output "origin_port" { value = var.origin_port }
output "security_group_id" { value = huaweicloud_networking_secgroup.host.id }
output "role_name" { value = huaweicloud_identity_agency.host.name }
output "role_arn" { value = huaweicloud_identity_agency.host.id }
output "deploy_bucket" { value = huaweicloud_obs_bucket.deploy.bucket }
output "deploy_bucket_arn" { value = huaweicloud_obs_bucket.deploy.bucket }
output "deploy_document" { value = "none (pull-based deploy: the host polls object storage)" }
output "public_ips" { value = huaweicloud_vpc_eip.host[*].address }
