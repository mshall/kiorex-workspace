# Pure data module (no provider): turns _docs/registry/service-url-registry.yaml into hosts, zones and certificate names.
# The registry is the ONLY place a hostname is written. Nothing here is typed by hand.
variable "registry_file" {
  type        = string
  description = "Path to service-url-registry.yaml."
}
variable "env_id" {
  type        = string
  description = "Registry environment id: dev | test | staging | pilot | prod."
}
variable "deploy_services" {
  type        = list(string)
  description = "Registry service ids this environment actually deploys (hosts only for these are created)."
}

locals {
  reg     = yamldecode(file(var.registry_file))
  env     = one([for e in local.reg.environments : e if e.id == var.env_id])
  by_id   = { for s in local.reg.services : s.id => s }
  domains = local.reg.domains

  # <service label>.<environment label>.<domain>; empty labels are skipped (prod has no environment label,
  # an empty service label is the environment apex).
  hosts = {
    for id in var.deploy_services : id => {
      id         = id
      kind       = local.by_id[id].kind
      exposure   = local.by_id[id].exposure
      status     = local.by_id[id].status
      domain_key = local.by_id[id].domain
      domain     = local.domains[local.by_id[id].domain]
      zone_name  = join(".", compact([local.env.label, local.domains[local.by_id[id].domain]]))
      fqdn       = join(".", compact([local.by_id[id].label, local.env.label, local.domains[local.by_id[id].domain]]))
    }
  }

  # One zone per registrable domain actually used. Child zone for non-prod (test.kiorex.com), the apex zone for prod.
  zone_names = { for k in distinct([for h in local.hosts : h.domain_key]) : k => join(".", compact([local.env.label, local.domains[k]])) }

  # One certificate per domain per environment: <env>.<domain> and *.<env>.<domain> (production: <domain>, *.<domain>).
  certificates = { for k, z in local.zone_names : k => { primary = z, sans = ["*.${z}"], zone_name = z } }
}

output "env" {
  value = { id = local.env.id, tag = local.env.tag, label = local.env.label, plane = local.env.plane, data_class = local.env.data_class }
}
output "hosts" { value = local.hosts }
output "zone_names" { value = local.zone_names }
output "certificates" { value = local.certificates }
output "legacy_hosts" {
  value = [for l in local.reg.legacy_hosts : l if l.env == var.env_id]
}
