# kx-pro (identifier prod). Major release for Egypt. REAL data. Founder initial production decision (27 Nov 2026): Huawei Cloud.
# The founder must verify: that the chosen Huawei region exists and serves Egypt, CBE and data residency requirements, and counsel's view.
# This file asserts none of that. The Huawei runtime paths are validated syntactically only (README, "What is verified").
provider_name = "huawei"
huawei_region = "REPLACE_AFTER_REGION_VERIFICATION"

enable_custom_domains = true # Huawei CDN requires a custom domain; needs NS delegation and an SCM certificate named kx-pro-<domain key>
create_dns_zones      = true
origin_allow_cidrs    = [] # REPLACE: Huawei CDN back-to-origin ranges; empty keeps the origin port closed (fail safe)

services = {
  "kiorex.api"         = { type = "api" }
  "kiorex.webhooks"    = { type = "api" }
  "kiorex.passport"    = { type = "api" }
  "kiorex.marketplace" = { type = "static", with_api = false }
  "kiorex.admin"       = { type = "static", with_api = false }
  "kiorly.pharmacies"  = { type = "static", with_api = true }
  "kiorly.labs"        = { type = "static", with_api = true }
}

images    = ["platform", "passport", "pharmacy-api", "lab-api"]
databases = ["platform", "passport", "pharmacy", "lab"]

compute = {
  instance_type  = "" # empty = choose a flavor by vcpus and memory_gb
  vcpus          = 4
  memory_gb      = 16
  arch           = "arm64" # Kunpeng where the region offers it; set x86_64 otherwise
  root_volume_gb = 60
  host_count     = 1 # stateless host: with a managed database it can be replaced in minutes (HA-capable, see README)
  deploy_mode    = "poll"
}

database = {
  mode                    = "managed" # private Huawei RDS for PostgreSQL, HA, encrypted, backups
  managed_instance_class  = "REPLACE_RDS_FLAVOR"
  managed_storage_gb      = 100
  managed_multi_az        = true
  managed_backup_days     = 14
  managed_password_secret = "kx-pro-dbmaster" # CSMS secret created by the founder (never in tfvars or state)
  data_volume_gb          = 20
  snapshot_retention_days = 14
  backup_retention_days   = 90
}

network = { vpc_cidr = "10.60.0.0/16" }

edge = {
  waf_enabled = false # WAF is AWS-only in this blueprint; on Huawei enable Cloud WAF in the console (README risk)
  noindex     = false
}

alert_emails       = []
monthly_budget_usd = 400
budget_scope       = "account"
github_repos       = []
