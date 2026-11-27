variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "services" {
  type = map(object({
    fqdn            = string
    certificate_key = string
  }))
  default     = {}
  description = "API / gateway / IdP services (registry id => host). One CDN distribution each; the origin routes by the X-Kx-Service header the CDN adds."
}
variable "origin_domains" {
  type        = list(string)
  description = "Origin host names; the first one is used (a second host needs a load balancer, not built yet)."
}
variable "origin_port" {
  type    = number
  default = 80
}
variable "origin_secret" {
  type        = string
  sensitive   = true
  description = "Shared header value proving the request came through this CDN (X-Origin-Secret)."
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
  type        = bool
  default     = true
  description = "Add X-Robots-Tag: noindex, nofollow (every environment except public production)."
}
variable "waf_enabled" {
  type    = bool
  default = false
}
variable "waf_rate_limit" {
  type        = number
  default     = 1000
  description = "Requests per 5 minutes per IP before blocking."
}
variable "region" {
  type        = string
  default     = ""
  description = "Huawei: region used to build default endpoints. Unused on AWS."
}
