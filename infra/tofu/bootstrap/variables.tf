variable "provider_name" {
  type        = string
  default     = "aws"
  description = "Where the state lives: aws (S3) or huawei (OBS). A Huawei environment may keep its state on AWS; state location is independent of where the environment runs."
  validation {
    condition     = contains(["aws", "huawei"], var.provider_name)
    error_message = "provider_name must be aws or huawei."
  }
}
variable "aws_region" {
  type    = string
  default = "eu-central-1"
}
variable "aws_account_id" {
  type        = string
  default     = ""
  description = "Safety lock for the AWS account that will hold the state (empty = no lock)."
}
variable "huawei_region" {
  type    = string
  default = "REPLACE_AFTER_REGION_VERIFICATION"
}
variable "bucket_name" {
  type        = string
  default     = ""
  description = "State bucket name. Empty = kx-tofu-state-<account id>-<region> on AWS."
}
variable "state_retention_days" {
  type        = number
  default     = 90
  description = "Non-current state versions are expired after this many days."
}
