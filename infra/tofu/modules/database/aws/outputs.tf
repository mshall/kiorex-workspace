output "mode" { value = var.mode }
output "db_host" { value = var.mode == "host" ? "postgres" : aws_db_instance.this[0].address }
output "db_port" { value = 5432 }
output "backup_bucket" { value = aws_s3_bucket.backup.bucket }
output "backup_bucket_arn" { value = aws_s3_bucket.backup.arn }
output "data_volume_id" { value = var.mode == "host" ? aws_ebs_volume.data[0].id : null }
output "master_secret_arn" {
  value = var.mode == "managed" ? aws_db_instance.this[0].master_user_secret[0].secret_arn : null
}
