output "registry_url" {
  description = "Registry host and namespace; images are <registry_url>/<image>:<tag>."
  value       = "${local.registry}/${var.name_prefix}"
}
output "repository_urls" { value = { for k, r in aws_ecr_repository.this : k => r.repository_url } }
output "ci_role_arn" { value = length(var.github_repos) > 0 ? aws_iam_role.ci[0].arn : null }
