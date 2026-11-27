variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "env" {
  type        = string
  description = "Registry environment id (test, pilot, prod)."
}
variable "region" {
  type        = string
  description = "Cloud region the host runs in (written to the host config)."
}
variable "vpc_id" { type = string }
variable "subnet_ids" {
  type        = list(string)
  description = "Public subnets; host i uses subnet i modulo the list length."
}
variable "host_count" {
  type        = number
  default     = 1
  description = "1 = single cost-minimal host. 2 = HA-capable (needs database_mode managed; jobs run on host 0 only)."
}
variable "arch" {
  type        = string
  default     = "arm64"
  description = "arm64 (Graviton / Kunpeng) or x86_64."
}
variable "instance_type" {
  type        = string
  default     = "t4g.medium"
  description = "Provider-native size. AWS: instance type. Huawei: flavor id or name (empty = pick by vcpus and memory_gb)."
}
variable "vcpus" {
  type    = number
  default = 2
}
variable "memory_gb" {
  type    = number
  default = 4
}
variable "root_volume_gb" {
  type    = number
  default = 30
}
variable "kms_key_id" {
  type        = string
  default     = null
  description = "Optional customer key for volumes; null uses the provider default key (still encrypted at rest)."
}
variable "cdn_ingress" {
  type        = string
  default     = "cdn_prefix_list"
  description = "cdn_prefix_list (AWS: CloudFront origin-facing managed prefix list) or cidrs (origin_allow_cidrs)."
}
variable "origin_allow_cidrs" {
  type        = list(string)
  default     = []
  description = "Source CIDRs allowed to reach the origin port when cdn_ingress = cidrs. Empty = port closed (fail safe)."
}
variable "key_pair" {
  type        = string
  default     = ""
  description = "Huawei only: name of a pre-created key pair (public key only). Unused on AWS (no key pair, SSM only)."
}
variable "deploy_mode" {
  type        = string
  default     = "ssm"
  description = "ssm = push (SSM Run Command, AWS); poll = host polls object storage every minute (any provider)."
  validation {
    condition     = contains(["ssm", "poll"], var.deploy_mode)
    error_message = "deploy_mode must be ssm or poll."
  }
}
variable "deploy_bucket_name" { type = string }
variable "backup_bucket_name" { type = string }
variable "secrets_prefix" {
  type        = string
  description = "Secret name prefix, for example /kx/test (secrets are <prefix>/<name>)."
}
variable "registry_url" {
  type        = string
  description = "Container registry host/namespace the host pulls from."
}
variable "ecr_repository_prefix" {
  type        = string
  default     = ""
  description = "AWS: ECR repository name prefix the host may pull (for example kx-test)."
}
variable "databases" {
  type        = list(string)
  description = "Product database names; the same list is the list of products with a secret bag."
}
variable "database_mode" {
  type    = string
  default = "host"
}
variable "host_files" {
  type        = map(string)
  description = "name => file content of the host scripts and systemd units (read by the stack from deploy/host)."
}
variable "origin_port" {
  type    = number
  default = 80
}
