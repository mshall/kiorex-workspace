# kx-test (identifier test). REAL data at small scale: the real clinic organisation on the existing AWS Clinic plus tagged dummy data.
# Real-data hygiene applies even here: encrypted volumes, private database, daily dump and snapshots, no public database port.
# No secret values in this file. Hosts come from the registry; none is typed here.
provider_name = "aws"
aws_region    = "eu-central-1"

enable_custom_domains = true # phase 2: NS delegation verified 27 Nov 2026 (test.kiorex.com and test.kiorly.com)
create_dns_zones      = true

services = {
  "kiorex.api"         = { type = "api" }
  "kiorex.webhooks"    = { type = "api" }
  "kiorex.passport"    = { type = "api" }
  "kiorex.marketplace" = { type = "static", with_api = true }  # the patient web calls /api/* on its own origin (apps/web has no API base URL setting)
  "kiorex.admin"       = { type = "static", with_api = true }  # same for the ops console
  "kiorly.pharmacies"  = { type = "static", with_api = true, api_paths = ["/marketplace/*"] } # signed Kiorex partner API (outside /api/v1 by contract)
  "kiorly.labs"        = { type = "static", with_api = true, api_paths = ["/marketplace/*"] }
  "kiorly.marketing"   = { type = "static", with_api = false, rewrite = "directory" } # apps/kiorly-site (multi-page, no API); test.kiorly.com
  "kiorly.admin"       = { type = "static", with_api = true, api_service = "kiorex.admin" } # the same Ops console build as kiorex.admin, Kiorly edition by host; /api/* to the Kiorex API
}

images    = ["platform", "passport", "pharmacy-api", "lab-api"]
databases = ["platform", "passport", "pharmacy", "lab"]

compute = {
  instance_type  = "t4g.medium" # 2 vCPU / 4 GB Graviton. t4g.small (2 GB) works only with swap; see README sizing.
  vcpus          = 2
  memory_gb      = 4
  arch           = "arm64"
  root_volume_gb = 30
  host_count     = 1
  deploy_mode    = "ssm"
}

database = {
  mode                    = "host" # PostgreSQL in a container on the host, data on its own encrypted volume, never publicly reachable
  data_volume_gb          = 20
  snapshot_retention_days = 7
  backup_retention_days   = 30
}

edge = {
  price_class = "PriceClass_100"
  waf_enabled = false
  noindex     = true
}

alert_emails       = ["admin@kiorex.com"] # role address (Google Group), not personal; budget and alarm notifications
monthly_budget_usd = 60
budget_scope       = "tag" # needs the EnvTag cost allocation tag activated once in Billing (founder step), else use "account"

github_repos = [
  "mshall/kiorex-platform",
  "mshall/kiorex-account",
  "mshall/kiorly-pharmacy",
  "mshall/kiorly-lab",
]
create_github_oidc_provider = false # the account already has token.actions.githubusercontent.com (used by the Clinic); it is only referenced

# READ-ONLY reference to the live Clinic. Never managed, imported or modified here; the Clinic has its own CDK stack.
clinic_distribution_id = "E1DE0H2K3M17YL"
