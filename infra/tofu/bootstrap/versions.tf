terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = "~> 1.70"
    }
  }
  # Deliberately local state: this stack creates the bucket that holds every other state. Keep this small state file safe (it holds no
  # secrets), or migrate it into the new bucket afterwards:  tofu init -migrate-state -backend-config=...
}
