variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "zones" {
  type        = map(string)
  default     = {}
  description = "domain key => zone name (test.kiorex.com). Child zones for non-prod, apex zones for prod. Empty map = no zones."
}
variable "cdn_records" {
  type = map(object({
    zone_key      = string
    fqdn          = string
    target        = string # CDN default hostname
    alias_zone_id = string # AWS CloudFront hosted zone id; ignored on Huawei
  }))
  default     = {}
  description = "Service hostnames pointing at the CDN. Empty until enable_custom_domains is true."
}
