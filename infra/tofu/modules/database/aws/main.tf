# ---------------------------------------------------------------- backups bucket (both modes): encrypted, private, versioned, expiring
resource "aws_s3_bucket" "backup" {
  bucket = var.backup_bucket_name
  tags   = var.tags
}
resource "aws_s3_bucket_public_access_block" "backup" {
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_id == null ? "AES256" : "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}
resource "aws_s3_bucket_versioning" "backup" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    id     = "expire-dumps"
    status = "Enabled"
    filter { prefix = "dumps/" }
    expiration { days = var.backup_retention_days }
    noncurrent_version_expiration { noncurrent_days = 7 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
resource "aws_s3_bucket_policy" "backup_tls" {
  bucket = aws_s3_bucket.backup.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.backup.arn, "${aws_s3_bucket.backup.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
data "aws_iam_policy_document" "backup_write" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.backup.arn}/dumps/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.backup.arn]
  }
}
resource "aws_iam_role_policy" "backup_write" {
  name   = "backup-write"
  role   = var.host_role_name
  policy = data.aws_iam_policy_document.backup_write.json
}

# ---------------------------------------------------------------- host mode: separate encrypted data volume + daily snapshot policy
resource "aws_ebs_volume" "data" {
  count             = var.mode == "host" ? 1 : 0
  availability_zone = var.availability_zone
  size              = var.data_volume_gb
  type              = "gp3"
  encrypted         = true
  kms_key_id        = var.kms_key_id
  tags              = merge(var.tags, { Name = "${var.name_prefix}-data", KxSnapshot = var.name_prefix })
  lifecycle {
    prevent_destroy = true # real data: removing it is a deliberate, manual decision (RUNBOOK section 9)
  }
}
resource "aws_volume_attachment" "data" {
  count        = var.mode == "host" ? 1 : 0
  device_name  = "/dev/sdf"
  volume_id    = aws_ebs_volume.data[0].id
  instance_id  = var.primary_instance_id
  force_detach = false
}

data "aws_iam_policy_document" "dlm_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "dlm" {
  count              = var.mode == "host" ? 1 : 0
  name               = "${var.name_prefix}-dlm"
  assume_role_policy = data.aws_iam_policy_document.dlm_assume.json
  tags               = var.tags
}
resource "aws_iam_role_policy_attachment" "dlm" {
  count      = var.mode == "host" ? 1 : 0
  role       = aws_iam_role.dlm[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}
resource "aws_dlm_lifecycle_policy" "data" {
  count              = var.mode == "host" ? 1 : 0
  description        = "${var.name_prefix} data volume daily snapshots"
  execution_role_arn = aws_iam_role.dlm[0].arn
  state              = "ENABLED"
  tags               = var.tags
  policy_details {
    resource_types = ["VOLUME"]
    target_tags    = { KxSnapshot = var.name_prefix }
    schedule {
      name = "daily"
      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["02:15"]
      }
      retain_rule { count = var.snapshot_retention_days }
      copy_tags = true
    }
  }
}

# ---------------------------------------------------------------- managed mode: private instance, no public address, encrypted, backups on
resource "aws_db_subnet_group" "this" {
  count      = var.mode == "managed" ? 1 : 0
  name       = "${var.name_prefix}-db"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}
resource "aws_security_group" "db" {
  count       = var.mode == "managed" ? 1 : 0
  name        = "${var.name_prefix}-db"
  description = "PostgreSQL from the host only"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-db" })
}
resource "aws_vpc_security_group_ingress_rule" "db_from_host" {
  count                        = var.mode == "managed" ? 1 : 0
  security_group_id            = aws_security_group.db[0].id
  referenced_security_group_id = var.host_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
resource "aws_db_instance" "this" {
  count                           = var.mode == "managed" ? 1 : 0
  identifier                      = "${var.name_prefix}-pg"
  engine                          = "postgres"
  engine_version                  = var.engine_version
  instance_class                  = var.managed_instance_class
  allocated_storage               = var.managed_storage_gb
  max_allocated_storage           = var.managed_storage_gb * 5
  storage_type                    = "gp3"
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_id
  db_subnet_group_name            = aws_db_subnet_group.this[0].name
  vpc_security_group_ids          = [aws_security_group.db[0].id]
  publicly_accessible             = false
  multi_az                        = var.managed_multi_az
  username                        = "kxadmin"
  manage_master_user_password     = true # the password lives in Secrets Manager, created and rotated by RDS; it is never in state or tfvars
  backup_retention_period         = var.managed_backup_days
  backup_window                   = "01:00-02:00"
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name_prefix}-pg-final"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  copy_tags_to_snapshot           = true
  tags                            = var.tags
}

# Non-secret connection facts for the host (host name and port only; credentials stay in the secret store).
resource "aws_secretsmanager_secret" "dbconn" {
  count                   = var.mode == "managed" ? 1 : 0
  name                    = "${var.secrets_prefix}/dbconn"
  recovery_window_in_days = 7
  tags                    = var.tags
}
resource "aws_secretsmanager_secret_version" "dbconn" {
  count         = var.mode == "managed" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.dbconn[0].id
  secret_string = jsonencode({ host = aws_db_instance.this[0].address, port = aws_db_instance.this[0].port })
}
