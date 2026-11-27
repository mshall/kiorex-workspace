locals {
  on_aws = var.provider_name == "aws"
}

provider "aws" {
  region                      = var.aws_region
  allowed_account_ids         = local.on_aws && var.aws_account_id != "" ? [var.aws_account_id] : null
  access_key                  = local.on_aws ? null : "unused"
  secret_key                  = local.on_aws ? null : "unused"
  skip_credentials_validation = !local.on_aws
  skip_requesting_account_id  = !local.on_aws
  skip_metadata_api_check     = !local.on_aws
  default_tags {
    tags = { Project = "kiorex", ManagedBy = "opentofu", Stack = "tofu-bootstrap", DataClass = "iac-state" }
  }
}

provider "huaweicloud" {
  region             = var.huawei_region
  access_key         = local.on_aws ? "unused" : null
  secret_key         = local.on_aws ? "unused" : null
  project_id         = local.on_aws ? "00000000000000000000000000000000" : null
  domain_id          = local.on_aws ? "00000000000000000000000000000000" : null
  skip_check_upgrade = true
}

data "aws_caller_identity" "current" {
  count = local.on_aws ? 1 : 0
}

locals {
  bucket = var.bucket_name != "" ? var.bucket_name : (local.on_aws ? "kx-tofu-state-${data.aws_caller_identity.current[0].account_id}-${var.aws_region}" : "kx-tofu-state")
}

# ---------------------------------------------------------------- AWS: versioned, encrypted, private bucket; locking is the S3 lock file (use_lockfile)
resource "aws_s3_bucket" "state" {
  count  = local.on_aws ? 1 : 0
  bucket = local.bucket
}
resource "aws_s3_bucket_public_access_block" "state" {
  count                   = local.on_aws ? 1 : 0
  bucket                  = aws_s3_bucket.state[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "state" {
  count  = local.on_aws ? 1 : 0
  bucket = aws_s3_bucket.state[0].id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  count  = local.on_aws ? 1 : 0
  bucket = aws_s3_bucket.state[0].id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  count  = local.on_aws ? 1 : 0
  bucket = aws_s3_bucket.state[0].id
  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = var.state_retention_days }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
resource "aws_s3_bucket_policy" "state" {
  count  = local.on_aws ? 1 : 0
  bucket = aws_s3_bucket.state[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state[0].arn, "${aws_s3_bucket.state[0].arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# ---------------------------------------------------------------- Huawei: private, versioned, KMS-encrypted OBS bucket (no lock support through the S3 API)
resource "huaweicloud_obs_bucket" "state" {
  count         = local.on_aws ? 0 : 1
  bucket        = local.bucket
  acl           = "private"
  storage_class = "STANDARD"
  encryption    = true
  versioning    = true
  force_destroy = false
  lifecycle_rule {
    name    = "expire-old-state-versions"
    enabled = true
    noncurrent_version_expiration { days = var.state_retention_days }
  }
}
