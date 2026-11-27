variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "env" { type = string }
variable "region" { type = string }
variable "images" {
  type        = list(string)
  description = "Image names; one repository <name_prefix>/<image> each."
}
variable "retention_count" {
  type    = number
  default = 15
}
variable "kms_key_id" {
  type    = string
  default = null
}
variable "github_repos" {
  type        = list(string)
  default     = []
  description = "GitHub repositories (owner/name) whose workflow may assume the CI role through OIDC (GitHub Environment named after env)."
}
variable "create_github_oidc_provider" {
  type        = bool
  default     = false
  description = "false: reuse the account's existing GitHub OIDC provider (kx-test account already has one). true in a fresh account (pilot, prod)."
}
variable "deploy_bucket_name" { type = string }
variable "deploy_document_name" {
  type    = string
  default = ""
}
variable "site_bucket_names" {
  type        = list(string)
  default     = []
  description = "Static site buckets the CI role may sync to."
}
variable "cloudfront_distribution_arns" {
  type        = list(string)
  default     = []
  description = "Distributions the CI role may invalidate."
}
