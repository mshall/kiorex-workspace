variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "env_tag" {
  type        = string
  description = "Value of the EnvTag cost allocation tag (kx-test, kx-pilot, kx-pro)."
}
variable "monthly_limit_usd" { type = number }
variable "emails" {
  type        = list(string)
  description = "Budget notification recipients."
}
variable "thresholds_percent" {
  type    = list(number)
  default = [50, 80, 100]
}
variable "scope" {
  type        = string
  default     = "tag"
  description = "tag = only resources tagged EnvTag=<env_tag> (the tag must be activated as a cost allocation tag in Billing, one-time founder step; test shares an account with the live Clinic). account = whole account."
  validation {
    condition     = contains(["tag", "account"], var.scope)
    error_message = "scope must be tag or account."
  }
}
