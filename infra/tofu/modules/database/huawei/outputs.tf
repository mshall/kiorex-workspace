output "mode" { value = var.mode }
output "db_host" { value = var.mode == "host" ? "postgres" : huaweicloud_rds_instance.this[0].private_ips[0] }
output "db_port" { value = 5432 }
output "backup_bucket" { value = huaweicloud_obs_bucket.backup.bucket }
output "backup_bucket_arn" { value = huaweicloud_obs_bucket.backup.bucket }
output "data_volume_id" { value = var.mode == "host" ? huaweicloud_evs_volume.data[0].id : null }
output "master_secret_arn" {
  value = var.mode == "managed" ? var.managed_password_secret_name : null
}
