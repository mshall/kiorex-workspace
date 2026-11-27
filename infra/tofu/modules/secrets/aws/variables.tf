variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "secrets_prefix" {
  type        = string
  description = "Secret name prefix, for example /kx/test. Convention /<product>/<env>/<purpose> from the launch guide is kept for the founder-owned bags: they live under <prefix>/<name>."
}
variable "names" {
  type        = list(string)
  description = "Secret bags to create EMPTY (containers only). Values are set by the founder or generated on the host, never written here."
}
variable "kms_key_id" {
  type    = string
  default = null
}
variable "recovery_window_days" {
  type    = number
  default = 7
}
variable "edge_secret_value" {
  type        = string
  default     = null
  sensitive   = true
  description = "THE one documented exception: the CDN-to-origin shared header value. It must exist in the CDN configuration, so it is in state (encrypted state bucket). Not a data credential; rotate per RUNBOOK."
}
variable "set_edge_secret" {
  type        = bool
  default     = false
  description = "Write edge_secret_value into the edge secret (a plain flag, so count never depends on the value)."
}
