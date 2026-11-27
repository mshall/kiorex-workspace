data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  registry   = "${local.account_id}.dkr.ecr.${var.region}.amazonaws.com"
}

resource "aws_ecr_repository" "this" {
  for_each             = toset(var.images)
  name                 = "${var.name_prefix}/${each.value}"
  image_tag_mutability = "MUTABLE" # tags are git SHAs; "current" style tags are not used by the deploy path
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration {
    encryption_type = var.kms_key_id == null ? "AES256" : "KMS"
    kms_key         = var.kms_key_id
  }
  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name
  policy = jsonencode({
    rules = [
      { rulePriority = 1, description = "expire untagged after 7 days", selection = { tagStatus = "untagged", countType = "sinceImagePushed", countUnit = "days", countNumber = 7 }, action = { type = "expire" } },
      { rulePriority = 2, description = "keep the newest ${var.retention_count}", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = var.retention_count }, action = { type = "expire" } }
    ]
  })
}

# ---------------------------------------------------------------- GitHub Actions OIDC (no long-lived keys in GitHub)
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider && length(var.github_repos) > 0 ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = var.tags
}

data "aws_iam_openid_connect_provider" "github" {
  count = !var.create_github_oidc_provider && length(var.github_repos) > 0 ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  oidc_arn = length(var.github_repos) == 0 ? "" : (var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn)
}

data "aws_iam_policy_document" "ci_assume" {
  count = length(var.github_repos) > 0 ? 1 : 0
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for r in var.github_repos : "repo:${r}:environment:${var.env}"] # only jobs bound to the GitHub Environment of this env (reviewers gate pilot and prod)
    }
  }
}

resource "aws_iam_role" "ci" {
  count                = length(var.github_repos) > 0 ? 1 : 0
  name                 = "${var.name_prefix}-ci"
  assume_role_policy   = data.aws_iam_policy_document.ci_assume[0].json
  max_session_duration = 3600
  tags                 = var.tags
}

data "aws_iam_policy_document" "ci" {
  count = length(var.github_repos) > 0 ? 1 : 0
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
    "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:DescribeImages"]
    resources = [for r in aws_ecr_repository.this : r.arn]
  }
  statement {
    sid       = "ReleaseUpload"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${var.deploy_bucket_name}", "arn:aws:s3:::${var.deploy_bucket_name}/releases/*"]
  }
  dynamic "statement" {
    for_each = length(var.site_bucket_names) > 0 ? [1] : []
    content {
      sid       = "SiteUpload"
      actions   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
      resources = flatten([for b in var.site_bucket_names : ["arn:aws:s3:::${b}", "arn:aws:s3:::${b}/*"]])
    }
  }
  dynamic "statement" {
    for_each = length(var.cloudfront_distribution_arns) > 0 ? [1] : []
    content {
      sid       = "SiteInvalidate"
      actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
      resources = var.cloudfront_distribution_arns
    }
  }
  statement {
    sid       = "TriggerDeployDocumentOnly"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.region}:${local.account_id}:document/${var.deploy_document_name}"]
  }
  statement {
    sid       = "TriggerOnTaggedHosts"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:${var.region}:${local.account_id}:instance/*"]
    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/KxEnv"
      values   = [var.env]
    }
  }
  statement {
    sid       = "ReadResult"
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ec2:DescribeInstances"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci" {
  count  = length(var.github_repos) > 0 ? 1 : 0
  name   = "ci"
  role   = aws_iam_role.ci[0].id
  policy = data.aws_iam_policy_document.ci[0].json
}
