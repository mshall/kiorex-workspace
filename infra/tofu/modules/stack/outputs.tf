output "provider_name" { value = var.provider_name }
output "env_tag" { value = local.env_tag }
output "hosts" {
  description = "Registry-generated host names of the deployed services."
  value       = { for id, h in local.hosts : id => h.fqdn }
}
output "default_urls" {
  description = "Where each service answers BEFORE custom domains are enabled."
  value       = { for id, d in local.cdn_targets : id => d.default_url }
}
output "name_servers" {
  description = "FOUNDER ACTION: add these NS records at the registrar for each child zone."
  value       = try(module.dns_zone_aws[0].name_servers, module.dns_zone_huawei[0].name_servers)
}
output "deploy" {
  value = {
    registry_url   = local.registry_url
    deploy_bucket  = local.deploy_bucket
    backup_bucket  = local.backup_bucket
    ssm_document   = try(module.compute_host_aws[0].deploy_document, null)
    instance_ids   = try(module.compute_host_aws[0].instance_ids, module.compute_host_huawei[0].instance_ids)
    origin_domains = local.origin_domains
    ci_role_arn    = try(module.container_registry_aws[0].ci_role_arn, null)
    static_buckets = { for id, s in local.static_sites_out : id => s.bucket }
    secrets_prefix = local.sec_pfx
    secret_names   = try(module.secrets_aws[0].secret_names, module.secrets_huawei[0].secret_names)
  }
}
output "budget_note" {
  value = try(module.budget_alarm_aws[0].note, module.budget_alarm_huawei[0].note, "no alert emails configured: budget and alarms not created")
}
output "clinic_reference" {
  description = "Read-only facts about the live Clinic distribution (data source only)."
  value       = try({ id = data.aws_cloudfront_distribution.clinic[0].id, domain_name = data.aws_cloudfront_distribution.clinic[0].domain_name, status = data.aws_cloudfront_distribution.clinic[0].status, managed_here = false }, null)
}
output "legacy_hosts" { value = module.registry.legacy_hosts }
