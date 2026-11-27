variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "env" { type = string }
variable "region" { type = string }
variable "emails" { type = list(string) }
variable "instance_ids" { type = list(string) }
variable "cdn_distribution_ids" {
  type        = map(string)
  default     = {}
  description = "name => CloudFront distribution id (5xx alarm)."
}
variable "backup_alarm_enabled" {
  type    = bool
  default = true
}
variable "managed_db_identifier" {
  type    = string
  default = ""
}
variable "cpu_threshold_percent" {
  type    = number
  default = 85
}
