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
# Clinic API egress: managed NAT gateway (about 36 USD per month) or the NAT instance (about 7 USD per month). See modules/clinic_link.
variable "clinic_egress_gateway_enabled" {
  type    = bool
  default = true
}
variable "clinic_egress_instance_enabled" {
  type    = bool
  default = false
}
variable "clinic_egress_route_via" {
  type    = string
  default = "gateway"
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
  egress_gateway_enabled     = var.clinic_egress_gateway_enabled
  egress_instance_enabled    = var.clinic_egress_instance_enabled
  egress_route_via           = var.clinic_egress_route_via
}

output "clinic_link" {
  value = try({ fqdn = module.clinic_link[0].fqdn, distribution_id = module.clinic_link[0].distribution_id, nat_gateway_id = module.clinic_link[0].nat_gateway_id, nat_instance_id = module.clinic_link[0].nat_instance_id, nat_instance_public_ip = module.clinic_link[0].nat_instance_public_ip }, null)
}
