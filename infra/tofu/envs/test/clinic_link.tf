# Clinic on the kx-test host name (registry service kiorly.clinics): second distribution in front of the LIVE Clinic, plus outbound
# internet for its API. Nothing of the Clinic CDK stack (legacy distribution, App Runner, RDS) is managed here.
variable "clinic_apprunner_domain" {
  type        = string
  default     = ""
  description = "Default domain of the Clinic App Runner service (technical name, not a secret). Empty = no Clinic link."
}
variable "clinic_link_egress" {
  type    = bool
  default = true
}

module "registry_clinic" {
  source          = "../../modules/registry"
  registry_file   = local.registry_file
  env_id          = "test"
  deploy_services = ["kiorly.clinics"]
}

data "aws_cloudfront_distribution" "clinic_legacy" {
  count = local.on_aws && var.clinic_apprunner_domain != "" ? 1 : 0
  id    = var.clinic_distribution_id
}

module "clinic_link" {
  count  = local.on_aws && var.clinic_apprunner_domain != "" ? 1 : 0
  source = "../../modules/clinic_link"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
  name_prefix                = "kx-test"
  fqdn                       = module.registry_clinic.hosts["kiorly.clinics"].fqdn
  zone_name                  = module.registry_clinic.hosts["kiorly.clinics"].zone_name
  legacy_distribution_domain = data.aws_cloudfront_distribution.clinic_legacy[0].domain_name
  apprunner_domain           = var.clinic_apprunner_domain
  noindex                    = var.edge.noindex
  enable_egress              = var.clinic_link_egress
}

output "clinic_link" {
  value = try({ fqdn = module.clinic_link[0].fqdn, distribution_id = module.clinic_link[0].distribution_id, nat_gateway_id = module.clinic_link[0].nat_gateway_id }, null)
}
