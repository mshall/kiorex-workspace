# kx-pilot: same design as test at larger scale. Default aws; can move to huawei at any time.
variable "provider_name" {
  type        = string
  default     = "aws"
  description = "aws | huawei. THE provider switch for this environment (RUNBOOK: switching cloud)."
  validation {
    condition     = contains(["aws", "huawei"], var.provider_name)
    error_message = "provider_name must be aws or huawei."
  }
}

variable "registry_file" {
  type        = string
  default     = ""
  description = "Override the path to service-url-registry.yaml (default: the workspace _docs/registry copy)."
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "aws_account_id" {
  type        = string
  default     = "REPLACE_WITH_PILOT_AWS_ACCOUNT_ID"
  description = "Safety lock: OpenTofu refuses to run against any other AWS account."
}

variable "huawei_region" {
  type        = string
  default     = "REPLACE_AFTER_REGION_VERIFICATION"
  description = "Huawei Cloud region id. The founder must verify which region serves Egypt and its data residency; nothing here asserts it."
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "services" {
  type = map(object({
    type     = string               # api = gateway/idp behind the CDN, routed by header; static = web bundle in object storage
    with_api = optional(bool, true) # static only: also proxy same-origin /api/* to the host
    api_paths = optional(list(string), []) # static with_api only: extra path patterns routed to the host besides /api/* (e.g. /marketplace/* for the signed partner API)
    api_service = optional(string, "") # static with_api only: X-Kx-Service value the origin routes on; empty = the service id itself (set it when the host serves another service's app, e.g. kiorly.admin -> kiorex.admin)
    rewrite     = optional(string, "spa") # spa = any path without a dot serves /index.html; directory = /x/ and /x serve /x/index.html (multi-page sites) and missing pages answer /404.html
    idp_proxy   = optional(bool, false) # static only (AWS): same-origin /idp/* is sent to the Passport origin with the prefix removed (Kiorly Home)
  }))
  description = "Registry service ids this environment deploys. Hostnames come from the registry, never from here."
  validation {
    condition     = alltrue([for s in values(var.services) : contains(["api", "static"], s.type)])
    error_message = "service type must be api or static."
  }
}

variable "images" {
  type        = list(string)
  description = "Container image names to create repositories for (built from each product repo's Dockerfile)."
}

variable "databases" {
  type        = list(string)
  description = "One database (and one secret bag) per product: platform, passport, pharmacy, lab."
}

variable "enable_custom_domains" {
  type        = bool
  default     = false
  description = "false: run on default CDN host names (no certificates, no DNS records). true: certificates + DNS records + CDN aliases from the registry. Needs the registrar NS delegation first."
}

variable "create_dns_zones" {
  type        = bool
  default     = true
  description = "Create the hosted zones so the founder can read the NS values early. Costs about USD 0.50 per zone per month."
}

variable "compute" {
  type = object({
    instance_type  = optional(string, "t4g.medium")
    vcpus          = optional(number, 2)
    memory_gb      = optional(number, 4)
    arch           = optional(string, "arm64")
    root_volume_gb = optional(number, 30)
    host_count     = optional(number, 1)
    key_pair       = optional(string, "")
    deploy_mode    = optional(string, "ssm")
  })
  default = {}
}

variable "database" {
  type = object({
    mode                    = optional(string, "host")
    data_volume_gb          = optional(number, 20)
    snapshot_retention_days = optional(number, 7)
    backup_retention_days   = optional(number, 30)
    managed_instance_class  = optional(string, "db.t4g.micro")
    managed_storage_gb      = optional(number, 20)
    managed_multi_az        = optional(bool, false)
    managed_backup_days     = optional(number, 7)
    managed_password_secret = optional(string, "")
    engine_version          = optional(string, "16")
  })
  default = {}
}

variable "network" {
  type = object({
    vpc_cidr = optional(string, "10.40.0.0/16")
  })
  default = {}
}

variable "edge" {
  type = object({
    price_class    = optional(string, "PriceClass_100")
    waf_enabled    = optional(bool, false)
    waf_rate_limit = optional(number, 1000)
    noindex        = optional(bool, true)
  })
  default = {}
}

variable "origin_allow_cidrs" {
  type        = list(string)
  default     = []
  description = "Huawei (and any cidrs mode): sources allowed to reach the origin port. Ignored on AWS (CloudFront prefix list)."
}

variable "alert_emails" {
  type        = list(string)
  default     = []
  description = "Budget and alarm recipients. Empty list = no subscriptions (budget and alarms are skipped when empty)."
}

variable "monthly_budget_usd" {
  type    = number
  default = 60
}

variable "budget_scope" {
  type    = string
  default = "tag"
}

variable "github_repos" {
  type        = list(string)
  default     = []
  description = "owner/name of the product repos allowed to deploy this environment through GitHub OIDC (AWS)."
}

variable "create_github_oidc_provider" {
  type    = bool
  default = false
}

variable "clinic_distribution_id" {
  type        = string
  default     = ""
  description = "READ-ONLY reference to the live Clinic CloudFront distribution (managed by its own CDK stack). Used only by a data source; never imported, modified or destroyed."
}
