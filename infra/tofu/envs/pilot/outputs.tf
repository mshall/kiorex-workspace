output "provider_name" { value = module.stack.provider_name }
output "env_tag" { value = module.stack.env_tag }
output "hosts" { value = module.stack.hosts }
output "default_urls" { value = module.stack.default_urls }
output "name_servers" {
  description = "FOUNDER ACTION: add these NS records at the registrar."
  value       = module.stack.name_servers
}
output "deploy" { value = module.stack.deploy }
output "budget_note" { value = module.stack.budget_note }
output "clinic_reference" { value = module.stack.clinic_reference }
output "legacy_hosts" { value = module.stack.legacy_hosts }
