output "registry_url" {
  description = "Registry host and namespace; images are <registry_url>/<image>:<tag>."
  value       = "swr.${var.region}.myhuaweicloud.com/${huaweicloud_swr_organization.this.name}"
}
output "repository_urls" { value = { for k, r in huaweicloud_swr_repository.this : k => "swr.${var.region}.myhuaweicloud.com/${r.organization}/${r.name}" } }
output "ci_role_arn" { value = null }
