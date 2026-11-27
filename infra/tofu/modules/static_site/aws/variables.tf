variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "sites" {
  type = map(object({
    fqdn            = string
    certificate_key = string
    api_service     = string # service header the origin routes /api/* on; empty = no /api behavior
    api_paths       = optional(list(string), []) # extra path patterns sent to the same origin (e.g. /marketplace/*)
  }))
  default     = {}
  description = "Web apps (registry id => host). Static bundle in object storage behind the CDN; /api/* goes same-origin to the host when api_service is set."
}
variable "origin_domains" {
  type    = list(string)
  default = []
}
variable "origin_port" {
  type    = number
  default = 80
}
variable "origin_secret" {
  type      = string
  sensitive = true
  default   = ""
}
variable "enable_custom_domains" {
  type    = bool
  default = false
}
variable "certificate_arns" {
  type    = map(string)
  default = {}
}
variable "price_class" {
  type    = string
  default = "PriceClass_100"
}
variable "noindex" {
  type    = bool
  default = true
}
variable "web_acl_arn" {
  type    = string
  default = null
}
variable "region" {
  type        = string
  default     = ""
  description = "Huawei: region used to build default endpoints. Unused on AWS."
}
