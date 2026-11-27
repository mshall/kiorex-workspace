variable "name_prefix" {
  type        = string
  description = "Resource name prefix, for example kx-test."
}
variable "tags" {
  type    = map(string)
  default = {}
}
variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}
variable "az_count" {
  type        = number
  default     = 1
  description = "Availability zones to use. 1 is enough for a single host; the managed database mode needs 2 (private subnets)."
}
variable "create_private_subnets" {
  type        = bool
  default     = false
  description = "Isolated subnets without any route to the internet (managed database only). No NAT is ever created (cost)."
}
variable "region" {
  type        = string
  default     = ""
  description = "Unused on AWS (the provider region applies); present so both providers share one interface."
}
