# Both providers are always configured; only the one selected by provider_name ever creates anything. The idle one gets dummy settings and
# skips every credential check, so a plan needs credentials for ONE cloud only. Credentials come from the environment, never from files:
#   AWS:    AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (CI uses GitHub OIDC)
#   Huawei: HW_ACCESS_KEY, HW_SECRET_KEY (and HW_REGION_NAME is not needed: huawei_region is set here)
locals {
  aws_tags = { ManagedBy = "opentofu", Project = "kiorex" }
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
    tags = local.aws_tags
  }
}

provider "aws" {
  alias                       = "us_east_1"
  region                      = "us-east-1"
  allowed_account_ids         = local.on_aws && var.aws_account_id != "" ? [var.aws_account_id] : null
  access_key                  = local.on_aws ? null : "unused"
  secret_key                  = local.on_aws ? null : "unused"
  skip_credentials_validation = !local.on_aws
  skip_requesting_account_id  = !local.on_aws
  skip_metadata_api_check     = !local.on_aws
  default_tags {
    tags = local.aws_tags
  }
}

provider "huaweicloud" {
  region     = var.huawei_region
  access_key = local.on_aws ? "unused" : null
  secret_key = local.on_aws ? "unused" : null
  # Idle (provider_name = aws): fixed ids stop the provider from calling the IAM API to look them up.
  project_id         = local.on_aws ? "00000000000000000000000000000000" : null
  domain_id          = local.on_aws ? "00000000000000000000000000000000" : null
  skip_check_upgrade = true
  # Only the selected provider is contacted. When provider_name = aws this configuration is inert.
  auth_url = "https://iam.myhuaweicloud.com/v3"
}
