variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "certificates" {
  type = map(object({
    primary   = string
    sans      = list(string)
    zone_name = string
  }))
  default     = {}
  description = "domain key => names (from the registry). One certificate per environment and domain: <env>.<domain> and *.<env>.<domain>."
}
variable "zone_ids" {
  type        = map(string)
  default     = {}
  description = "domain key => DNS zone id used for validation records (AWS)."
}
variable "wait_for_validation" {
  type        = bool
  default     = true
  description = "Block until DNS validation succeeds. Needs the registrar NS delegation to be in place."
}
