# kx-pilot (identifier pilot). Same design as kx-test, larger scale, production-grade controls. REAL data.
# Founder decision 27 Nov 2026: pilot is its own stack (ADR-059 had pilot on the prod data plane; see README "Pilot and the ADR").
provider_name  = "aws"
aws_region     = "eu-central-1"
aws_account_id = "REPLACE_WITH_PILOT_AWS_ACCOUNT_ID" # separate production account (KX-21 HB05); the lock refuses any other account

enable_custom_domains = false
create_dns_zones      = true

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
  instance_type  = "t4g.large" # 2 vCPU / 8 GB
  vcpus          = 2
  memory_gb      = 8
  arch           = "arm64"
  root_volume_gb = 40
  host_count     = 1
  deploy_mode    = "ssm"
}

database = {
  mode                    = "host"
  data_volume_gb          = 60
  snapshot_retention_days = 14
  backup_retention_days   = 60
}

edge = {
  price_class = "PriceClass_100"
  waf_enabled = true
  noindex     = true # noindex until general availability (PILOT_ENVIRONMENT_STRATEGY)
}

alert_emails       = []
monthly_budget_usd = 150
budget_scope       = "account" # own account

github_repos = [
  "mshall/kiorex-platform",
  "mshall/kiorex-account",
  "mshall/kiorly-pharmacy",
  "mshall/kiorly-lab",
]
create_github_oidc_provider = true # fresh account
clinic_distribution_id      = ""
