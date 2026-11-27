data "aws_caller_identity" "current" {
  count = var.provider_name == "aws" ? 1 : 0
}

locals {
  is_aws   = var.provider_name == "aws"
  is_hw    = var.provider_name == "huawei"
  hosts    = module.registry.hosts
  env_tag  = module.registry.env.tag # kx-test | kx-pilot | kx-pro
  prefix   = local.env_tag
  sec_pfx  = "/kx/${var.env_id}"
  acct     = local.is_aws ? data.aws_caller_identity.current[0].account_id : "hw"
  all_tags = merge({ Env = var.env_id, EnvTag = local.env_tag, ManagedBy = "opentofu", Project = "kiorex", CostCenter = "kiorex-platform", DataClass = module.registry.env.data_class }, var.tags)

  api_services    = { for id, s in var.services : id => s if s.type == "api" }
  static_services = { for id, s in var.services : id => s if s.type == "static" }

  deploy_bucket = local.is_aws ? "${local.prefix}-deploy-${local.acct}" : "${local.prefix}-deploy"
  backup_bucket = local.is_aws ? "${local.prefix}-backups-${local.acct}" : "${local.prefix}-backups"
  secret_names  = concat(var.databases, ["postgres", "edge"])

  host_files = {
    for f in fileset("${path.module}/../../deploy/host", "*") : f => file("${path.module}/../../deploy/host/${f}")
    if f != "cloud-init.yaml.tftpl" && !endswith(f, ".md")
  }

  managed_db         = var.database.mode == "managed"
  subnet_ids         = try(module.network_aws[0].public_subnet_ids, module.network_huawei[0].public_subnet_ids)
  vpc_id             = try(module.network_aws[0].vpc_id, module.network_huawei[0].vpc_id)
  private_subnet_ids = try(module.network_aws[0].private_subnet_ids, module.network_huawei[0].private_subnet_ids)

  host               = try(module.compute_host_aws[0], module.compute_host_huawei[0])
  origin_domains     = try(module.compute_host_aws[0].origin_domains, module.compute_host_huawei[0].origin_domains)
  origin_port        = 80
  registry_url       = try(module.container_registry_aws[0].registry_url, module.container_registry_huawei[0].registry_url)
  certificate_arns   = try(module.certificate_aws[0].certificate_arns, module.certificate_huawei[0].certificate_arns)
  zone_ids           = try(module.dns_zone_aws[0].zone_ids, module.dns_zone_huawei[0].zone_ids)
  edge_distributions = try(module.cdn_api_edge_aws[0].distributions, module.cdn_api_edge_huawei[0].distributions)
  # one(concat(splat)) rather than try(): try() turns the whole map unknown as soon as one site has apply-time attributes, which breaks for_each keys downstream
  static_sites_out   = one(concat(module.static_site_aws[*].sites, module.static_site_huawei[*].sites))
  waf_acl_arn        = try(module.cdn_api_edge_aws[0].web_acl_arn, null)

  zones        = var.create_dns_zones || var.enable_custom_domains ? module.registry.zone_names : {}
  certificates = var.enable_custom_domains ? module.registry.certificates : {}

  # Everything the CDN serves, by registry id, with its generated host name.
  cdn_targets = merge(
    { for id, d in local.edge_distributions : id => d },
    { for id, d in local.static_sites_out : id => d },
  )
  cdn_records = var.enable_custom_domains ? {
    for id, h in local.hosts : id => {
      zone_key      = h.domain_key
      fqdn          = h.fqdn
      target        = local.cdn_targets[id].domain_name
      alias_zone_id = local.cdn_targets[id].hosted_zone_id
    }
  } : {}
}

check "huawei_needs_custom_domains" {
  assert {
    condition     = !(local.is_hw && !var.enable_custom_domains)
    error_message = "Huawei CDN cannot serve without a custom domain: with enable_custom_domains = false no CDN is created and services are reachable only on the host Elastic IP (set origin_allow_cidrs to your own address for the first smoke test)."
  }
}
check "single_host_only" {
  assert {
    condition     = var.compute.host_count == 1
    error_message = "host_count > 1 needs a load balancer module that is not built yet; the HA path today is a stateless host plus a managed multi-AZ database (see README, section High availability)."
  }
}
check "managed_db_needs_ha_inputs" {
  assert {
    condition     = !local.managed_db || length(local.private_subnet_ids) >= 2
    error_message = "database.mode = managed needs two private subnets."
  }
}

# ---------------------------------------------------------------- registry (hosts are generated, never typed)
module "registry" {
  source          = "../registry"
  registry_file   = var.registry_file
  env_id          = var.env_id
  deploy_services = keys(var.services)
}

# ---------------------------------------------------------------- origin secret (documented exception: lives in encrypted state)
resource "random_password" "origin" {
  length  = 48
  special = false
}

# ---------------------------------------------------------------- network
module "network_aws" {
  count                  = local.is_aws ? 1 : 0
  source                 = "../network/aws"
  name_prefix            = local.prefix
  tags                   = local.all_tags
  vpc_cidr               = var.network.vpc_cidr
  az_count               = local.managed_db ? 2 : 1
  create_private_subnets = local.managed_db
}
module "network_huawei" {
  count                  = local.is_hw ? 1 : 0
  source                 = "../network/huawei"
  name_prefix            = local.prefix
  tags                   = local.all_tags
  vpc_cidr               = var.network.vpc_cidr
  az_count               = local.managed_db ? 2 : 1
  create_private_subnets = local.managed_db
  region                 = var.region
}

# ---------------------------------------------------------------- container registry (+ GitHub OIDC role on AWS)
module "container_registry_aws" {
  count                        = local.is_aws ? 1 : 0
  source                       = "../container_registry/aws"
  name_prefix                  = local.prefix
  tags                         = local.all_tags
  env                          = var.env_id
  region                       = var.region
  images                       = var.images
  github_repos                 = var.github_repos
  create_github_oidc_provider  = var.create_github_oidc_provider
  deploy_bucket_name           = local.deploy_bucket
  deploy_document_name         = "${local.prefix}-deploy"
  site_bucket_names            = [for id, s in local.static_sites_out : s.bucket]
  cloudfront_distribution_arns = concat([for id, d in local.edge_distributions : d.arn], [for id, s in local.static_sites_out : s.arn])
}
module "container_registry_huawei" {
  count              = local.is_hw ? 1 : 0
  source             = "../container_registry/huawei"
  name_prefix        = local.prefix
  tags               = local.all_tags
  env                = var.env_id
  region             = var.region
  images             = var.images
  deploy_bucket_name = local.deploy_bucket
}

# ---------------------------------------------------------------- secrets (containers only; values never in tfvars or state, except the edge header)
module "secrets_aws" {
  count             = local.is_aws ? 1 : 0
  source            = "../secrets/aws"
  name_prefix       = local.prefix
  tags              = local.all_tags
  secrets_prefix    = local.sec_pfx
  names             = local.secret_names
  edge_secret_value = random_password.origin.result
  set_edge_secret   = true
}
module "secrets_huawei" {
  count             = local.is_hw ? 1 : 0
  source            = "../secrets/huawei"
  name_prefix       = local.prefix
  tags              = local.all_tags
  secrets_prefix    = local.sec_pfx
  names             = local.secret_names
  edge_secret_value = random_password.origin.result
  set_edge_secret   = true
}

# ---------------------------------------------------------------- the single host
module "compute_host_aws" {
  count                 = local.is_aws ? 1 : 0
  source                = "../compute_host/aws"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  env                   = var.env_id
  region                = var.region
  vpc_id                = local.vpc_id
  subnet_ids            = local.subnet_ids
  host_count            = var.compute.host_count
  arch                  = var.compute.arch
  instance_type         = var.compute.instance_type
  vcpus                 = var.compute.vcpus
  memory_gb             = var.compute.memory_gb
  root_volume_gb        = var.compute.root_volume_gb
  cdn_ingress           = "cdn_prefix_list"
  deploy_mode           = var.compute.deploy_mode
  deploy_bucket_name    = local.deploy_bucket
  backup_bucket_name    = local.backup_bucket
  secrets_prefix        = local.sec_pfx
  registry_url          = local.registry_url
  ecr_repository_prefix = local.prefix
  databases             = var.databases
  database_mode         = var.database.mode
  host_files            = local.host_files
  origin_port           = local.origin_port
}
module "compute_host_huawei" {
  count              = local.is_hw ? 1 : 0
  source             = "../compute_host/huawei"
  name_prefix        = local.prefix
  tags               = local.all_tags
  env                = var.env_id
  region             = var.region
  vpc_id             = local.vpc_id
  subnet_ids         = local.subnet_ids
  host_count         = var.compute.host_count
  arch               = var.compute.arch
  instance_type      = var.compute.instance_type
  vcpus              = var.compute.vcpus
  memory_gb          = var.compute.memory_gb
  root_volume_gb     = var.compute.root_volume_gb
  cdn_ingress        = "cidrs"
  origin_allow_cidrs = var.origin_allow_cidrs
  key_pair           = var.compute.key_pair
  deploy_mode        = "poll"
  deploy_bucket_name = local.deploy_bucket
  backup_bucket_name = local.backup_bucket
  secrets_prefix     = local.sec_pfx
  registry_url       = local.registry_url
  databases          = var.databases
  database_mode      = var.database.mode
  host_files         = local.host_files
  origin_port        = local.origin_port
}

# ---------------------------------------------------------------- database (private; encrypted; separate database per product)
module "database_aws" {
  count                   = local.is_aws ? 1 : 0
  source                  = "../database/aws"
  name_prefix             = local.prefix
  tags                    = local.all_tags
  env                     = var.env_id
  region                  = var.region
  mode                    = var.database.mode
  vpc_id                  = local.vpc_id
  private_subnet_ids      = local.private_subnet_ids
  host_security_group_id  = module.compute_host_aws[0].security_group_id
  host_role_name          = module.compute_host_aws[0].role_name
  primary_instance_id     = module.compute_host_aws[0].primary_instance_id
  availability_zone       = module.compute_host_aws[0].primary_availability_zone
  databases               = var.databases
  data_volume_gb          = var.database.data_volume_gb
  snapshot_retention_days = var.database.snapshot_retention_days
  backup_bucket_name      = local.backup_bucket
  backup_retention_days   = var.database.backup_retention_days
  secrets_prefix          = local.sec_pfx
  managed_instance_class  = var.database.managed_instance_class
  managed_storage_gb      = var.database.managed_storage_gb
  managed_multi_az        = var.database.managed_multi_az
  managed_backup_days     = var.database.managed_backup_days
  engine_version          = var.database.engine_version
}
module "database_huawei" {
  count                        = local.is_hw ? 1 : 0
  source                       = "../database/huawei"
  name_prefix                  = local.prefix
  tags                         = local.all_tags
  env                          = var.env_id
  region                       = var.region
  mode                         = var.database.mode
  vpc_id                       = local.vpc_id
  private_subnet_ids           = local.private_subnet_ids
  host_security_group_id       = module.compute_host_huawei[0].security_group_id
  host_role_name               = module.compute_host_huawei[0].role_name
  primary_instance_id          = module.compute_host_huawei[0].primary_instance_id
  availability_zone            = module.compute_host_huawei[0].primary_availability_zone
  databases                    = var.databases
  data_volume_gb               = var.database.data_volume_gb
  snapshot_retention_days      = var.database.snapshot_retention_days
  backup_bucket_name           = local.backup_bucket
  backup_retention_days        = var.database.backup_retention_days
  secrets_prefix               = local.sec_pfx
  managed_instance_class       = var.database.managed_instance_class
  managed_storage_gb           = var.database.managed_storage_gb
  managed_multi_az             = var.database.managed_multi_az
  managed_backup_days          = var.database.managed_backup_days
  managed_password_secret_name = var.database.managed_password_secret
  engine_version               = var.database.engine_version
}

# ---------------------------------------------------------------- DNS zones and certificates (custom domains)
module "dns_zone_aws" {
  count       = local.is_aws ? 1 : 0
  source      = "../dns_zone/aws"
  name_prefix = local.prefix
  tags        = local.all_tags
  zones       = local.zones
  cdn_records = local.cdn_records
}
module "dns_zone_huawei" {
  count       = local.is_hw ? 1 : 0
  source      = "../dns_zone/huawei"
  name_prefix = local.prefix
  tags        = local.all_tags
  zones       = local.zones
  cdn_records = local.cdn_records
}
module "certificate_aws" {
  count        = local.is_aws ? 1 : 0
  source       = "../certificate/aws"
  name_prefix  = local.prefix
  tags         = local.all_tags
  certificates = local.certificates
  zone_ids     = try(module.dns_zone_aws[0].zone_ids, {})
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
module "certificate_huawei" {
  count        = local.is_hw ? 1 : 0
  source       = "../certificate/huawei"
  name_prefix  = local.prefix
  tags         = local.all_tags
  certificates = local.certificates
}

# ---------------------------------------------------------------- CDN: APIs behind the CDN (origin-secret header, SG limited to the CDN)
module "cdn_api_edge_aws" {
  count                 = local.is_aws ? 1 : 0
  source                = "../cdn_api_edge/aws"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  services              = { for id, s in local.api_services : id => { fqdn = local.hosts[id].fqdn, certificate_key = local.hosts[id].domain_key } }
  origin_domains        = local.origin_domains
  origin_port           = local.origin_port
  origin_secret         = random_password.origin.result
  enable_custom_domains = var.enable_custom_domains
  certificate_arns      = local.certificate_arns
  price_class           = var.edge.price_class
  noindex               = var.edge.noindex
  waf_enabled           = var.edge.waf_enabled
  waf_rate_limit        = var.edge.waf_rate_limit
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
module "cdn_api_edge_huawei" {
  count                 = local.is_hw ? 1 : 0
  source                = "../cdn_api_edge/huawei"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  services              = { for id, s in local.api_services : id => { fqdn = local.hosts[id].fqdn, certificate_key = local.hosts[id].domain_key } }
  origin_domains        = local.origin_domains
  origin_port           = local.origin_port
  origin_secret         = random_password.origin.result
  enable_custom_domains = var.enable_custom_domains
  certificate_arns      = local.certificate_arns
  noindex               = var.edge.noindex
  region                = var.region
}

# ---------------------------------------------------------------- CDN: static web apps (+ same-origin /api/*)
module "static_site_aws" {
  count                 = local.is_aws ? 1 : 0
  source                = "../static_site/aws"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  sites                 = { for id, s in local.static_services : id => { fqdn = local.hosts[id].fqdn, certificate_key = local.hosts[id].domain_key, api_service = s.with_api ? (s.api_service != "" ? s.api_service : id) : "", api_paths = s.api_paths, rewrite = s.rewrite } }
  origin_domains        = local.origin_domains
  origin_port           = local.origin_port
  origin_secret         = random_password.origin.result
  enable_custom_domains = var.enable_custom_domains
  certificate_arns      = local.certificate_arns
  price_class           = var.edge.price_class
  noindex               = var.edge.noindex
  web_acl_arn           = local.waf_acl_arn
}
module "static_site_huawei" {
  count                 = local.is_hw ? 1 : 0
  source                = "../static_site/huawei"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  sites                 = { for id, s in local.static_services : id => { fqdn = local.hosts[id].fqdn, certificate_key = local.hosts[id].domain_key, api_service = s.with_api ? (s.api_service != "" ? s.api_service : id) : "", api_paths = s.api_paths, rewrite = s.rewrite } }
  origin_domains        = local.origin_domains
  origin_port           = local.origin_port
  origin_secret         = random_password.origin.result
  enable_custom_domains = var.enable_custom_domains
  certificate_arns      = local.certificate_arns
  noindex               = var.edge.noindex
  region                = var.region
}

# ---------------------------------------------------------------- budget and alarms (only when someone is subscribed)
module "budget_alarm_aws" {
  count             = local.is_aws && length(var.alert_emails) > 0 ? 1 : 0
  source            = "../budget_alarm/aws"
  name_prefix       = local.prefix
  tags              = local.all_tags
  env_tag           = local.env_tag
  monthly_limit_usd = var.monthly_budget_usd
  emails            = var.alert_emails
  scope             = var.budget_scope
}
module "budget_alarm_huawei" {
  count             = local.is_hw ? 1 : 0
  source            = "../budget_alarm/huawei"
  name_prefix       = local.prefix
  tags              = local.all_tags
  env_tag           = local.env_tag
  monthly_limit_usd = var.monthly_budget_usd
  emails            = var.alert_emails
  scope             = var.budget_scope
}
module "monitoring_alarms_aws" {
  count                 = local.is_aws && length(var.alert_emails) > 0 ? 1 : 0
  source                = "../monitoring_alarms/aws"
  name_prefix           = local.prefix
  tags                  = local.all_tags
  env                   = var.env_id
  region                = var.region
  emails                = var.alert_emails
  instance_ids          = module.compute_host_aws[0].instance_ids
  cdn_distribution_ids  = { for id, d in local.cdn_targets : id => d.distribution_id }
  backup_alarm_enabled  = !local.managed_db
  managed_db_identifier = local.managed_db ? "${local.prefix}-pg" : ""
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
module "monitoring_alarms_huawei" {
  count        = local.is_hw && length(var.alert_emails) > 0 ? 1 : 0
  source       = "../monitoring_alarms/huawei"
  name_prefix  = local.prefix
  tags         = local.all_tags
  env          = var.env_id
  region       = var.region
  emails       = var.alert_emails
  instance_ids = module.compute_host_huawei[0].instance_ids
}

# ---------------------------------------------------------------- READ-ONLY reference to the live Clinic (never managed)
data "aws_cloudfront_distribution" "clinic" {
  count = local.is_aws && var.clinic_distribution_id != "" ? 1 : 0
  id    = var.clinic_distribution_id
}
