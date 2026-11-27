data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/${var.arch == "arm64" ? "arm64" : "amd64"}/hvm/ebs-gp3/ami-id"
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  secret_arn = "arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:${var.secrets_prefix}"
  docs_name  = "${var.name_prefix}-deploy"
}

# ---------------------------------------------------------------- deploy artifacts bucket (compose files, release manifests)
resource "aws_s3_bucket" "deploy" {
  bucket = var.deploy_bucket_name
  tags   = var.tags
}
resource "aws_s3_bucket_public_access_block" "deploy" {
  bucket                  = aws_s3_bucket.deploy.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "deploy" {
  bucket = aws_s3_bucket.deploy.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_id == null ? "AES256" : "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
  }
}
resource "aws_s3_bucket_versioning" "deploy" {
  bucket = aws_s3_bucket.deploy.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_lifecycle_configuration" "deploy" {
  bucket = aws_s3_bucket.deploy.id
  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 30 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
resource "aws_s3_bucket_policy" "deploy_tls" {
  bucket = aws_s3_bucket.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.deploy.arn, "${aws_s3_bucket.deploy.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}

# ---------------------------------------------------------------- identity of the host
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "host" {
  name               = "${var.name_prefix}-host"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
data "aws_iam_policy_document" "host" {
  statement {
    sid       = "ReadSecrets"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = ["${local.secret_arn}/*"]
  }
  statement {
    sid       = "GenerateDatabasePasswordsOnce"
    actions   = ["secretsmanager:PutSecretValue"]
    resources = ["${local.secret_arn}/postgres-*"]
  }
  statement {
    sid       = "ReadDeployArtifacts"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.deploy.arn, "${aws_s3_bucket.deploy.arn}/*"]
  }
  statement {
    sid       = "WriteAppliedMarker"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.deploy.arn}/state/*"]
  }
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid       = "EcrPull"
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = ["arn:aws:ecr:${var.region}:${local.account_id}:repository/${var.ecr_repository_prefix}/*"]
  }
  statement {
    sid       = "HeartbeatMetric"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = "StringLike"
      variable = "cloudwatch:namespace"
      values   = ["Kiorex/*"]
    }
  }
}
resource "aws_iam_role_policy" "host" {
  name   = "host"
  role   = aws_iam_role.host.id
  policy = data.aws_iam_policy_document.host.json
}
resource "aws_iam_instance_profile" "host" {
  name = "${var.name_prefix}-host"
  role = aws_iam_role.host.name
}

# ---------------------------------------------------------------- network exposure: only the CDN may reach the origin port
resource "aws_security_group" "host" {
  name        = "${var.name_prefix}-host"
  description = "Origin port from the CDN only. No SSH, no database port."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-host" })
}
resource "aws_vpc_security_group_ingress_rule" "cdn_prefix_list" {
  count             = var.cdn_ingress == "cdn_prefix_list" ? 1 : 0
  security_group_id = aws_security_group.host.id
  description       = "CloudFront origin-facing prefix list"
  ip_protocol       = "tcp"
  from_port         = var.origin_port
  to_port           = var.origin_port
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}
resource "aws_vpc_security_group_ingress_rule" "cidrs" {
  for_each          = var.cdn_ingress == "cidrs" ? toset(var.origin_allow_cidrs) : toset([])
  security_group_id = aws_security_group.host.id
  description       = "Allowed origin source"
  ip_protocol       = "tcp"
  from_port         = var.origin_port
  to_port           = var.origin_port
  cidr_ipv4         = each.value
}
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.host.id
  description       = "Registry, package mirrors, object storage, secret store"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------------------------------------------------------------- the host(s)
locals {
  host_files_gz = { for n, c in var.host_files : n => base64gzip(c) }
  cli_install   = "curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install"
}

resource "aws_instance" "host" {
  count                  = var.host_count
  ami                    = nonsensitive(data.aws_ssm_parameter.ami.value)
  instance_type          = var.instance_type
  subnet_id              = var.subnet_ids[count.index % length(var.subnet_ids)]
  vpc_security_group_ids = [aws_security_group.host.id]
  iam_instance_profile   = aws_iam_instance_profile.host.name
  key_name               = null # no key pair: nobody can SSH; access is SSM Session Manager
  monitoring             = false
  ebs_optimized          = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 1          # containers cannot reach the instance role credentials
  }
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true
    kms_key_id            = var.kms_key_id
    delete_on_termination = true
  }
  user_data = templatefile("${path.module}/../../../deploy/host/cloud-init.yaml.tftpl", {
    provider       = "aws", env = var.env, region = var.region, deploy_bucket = var.deploy_bucket_name, backup_bucket = var.backup_bucket_name,
    secrets_prefix = var.secrets_prefix, registry_url = var.registry_url, db_mode = var.database_mode, databases = join(" ", var.databases),
    deploy_mode    = var.deploy_mode, jobs_host = count.index == 0 ? "true" : "false", files = local.host_files_gz, provider_cli_install = local.cli_install
  })
  tags = merge(var.tags, {
    Name  = "${var.name_prefix}-host-${count.index}"
    KxEnv = var.env
  })
  volume_tags = merge(var.tags, { Name = "${var.name_prefix}-root-${count.index}" })

  lifecycle {
    ignore_changes = [ami, user_data] # a new AMI or edited bootstrap never replaces a host that holds data; see RUNBOOK (host replacement)
  }
}

resource "aws_eip" "host" {
  count    = var.host_count
  instance = aws_instance.host[count.index].id
  domain   = "vpc"
  tags     = merge(var.tags, { Name = "${var.name_prefix}-host-${count.index}" })
}

# ---------------------------------------------------------------- deploy trigger: one SSM document that can only run the deploy script
resource "aws_ssm_document" "deploy" {
  name            = local.docs_name
  document_type   = "Command"
  document_format = "JSON"
  tags            = var.tags
  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Apply the release in the deploy bucket (or roll back). Runs only /usr/local/lib/kx/kx-deploy.sh."
    parameters = {
      mode = { type = "String", default = "apply", allowedValues = ["apply", "rollback"] }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "deploy"
      inputs = {
        timeoutSeconds = "900"
        runCommand     = ["if [ \"{{ mode }}\" = rollback ]; then /usr/local/lib/kx/kx-deploy.sh --rollback; else KX_FORCE=1 /usr/local/lib/kx/kx-deploy.sh; fi"]
      }
    }]
  })
}
