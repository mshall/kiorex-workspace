locals {
  registry_file = var.registry_file != "" ? var.registry_file : "${path.module}/../../../../_docs/registry/service-url-registry.yaml"
  on_aws        = var.provider_name == "aws"
}

module "stack" {
  source = "../../modules/stack"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
    huaweicloud   = huaweicloud
  }

  provider_name               = var.provider_name
  env_id                      = "test"
  registry_file               = local.registry_file
  region                      = local.on_aws ? var.aws_region : var.huawei_region
  tags                        = var.tags
  services                    = var.services
  images                      = var.images
  databases                   = var.databases
  enable_custom_domains       = var.enable_custom_domains
  create_dns_zones            = var.create_dns_zones
  compute                     = var.compute
  database                    = var.database
  network                     = var.network
  edge                        = var.edge
  origin_allow_cidrs          = var.origin_allow_cidrs
  alert_emails                = var.alert_emails
  monthly_budget_usd          = var.monthly_budget_usd
  budget_scope                = var.budget_scope
  github_repos                = var.github_repos
  create_github_oidc_provider = var.create_github_oidc_provider
  clinic_distribution_id      = local.on_aws ? var.clinic_distribution_id : ""
}
