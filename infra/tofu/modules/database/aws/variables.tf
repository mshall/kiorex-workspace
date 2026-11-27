variable "name_prefix" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
variable "env" { type = string }
variable "region" { type = string }
variable "mode" {
  type        = string
  default     = "host"
  description = "host = PostgreSQL in a container on the host, data on a separate encrypted volume. managed = private managed instance (RDS / Huawei RDS). Never publicly reachable in either mode."
  validation {
    condition     = contains(["host", "managed"], var.mode)
    error_message = "mode must be host or managed."
  }
}
variable "vpc_id" { type = string }
variable "private_subnet_ids" {
  type    = list(string)
  default = []
}
variable "host_security_group_id" { type = string }
variable "host_role_name" { type = string }
variable "primary_instance_id" { type = string }
variable "availability_zone" { type = string }
variable "databases" {
  type        = list(string)
  description = "One database per product (never shared)."
}
variable "data_volume_gb" {
  type    = number
  default = 20
}
variable "snapshot_retention_days" {
  type        = number
  default     = 7
  description = "Disk snapshot policy: one per day, kept this many days."
}
variable "backup_bucket_name" { type = string }
variable "backup_retention_days" {
  type        = number
  default     = 30
  description = "Daily dumps in object storage expire after this many days."
}
variable "kms_key_id" {
  type    = string
  default = null
}
variable "secrets_prefix" { type = string }
variable "managed_instance_class" {
  type    = string
  default = "db.t4g.micro"
}
variable "managed_storage_gb" {
  type    = number
  default = 20
}
variable "managed_multi_az" {
  type    = bool
  default = false
}
variable "managed_backup_days" {
  type    = number
  default = 7
}
variable "engine_version" {
  type    = string
  default = "16"
}
