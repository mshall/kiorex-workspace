variable "name_prefix" {
  type        = string
  description = "Resource name prefix, for example kx-test."
}
variable "fqdn" {
  type        = string
  description = "Public host of the Clinic on this environment (registry service kiorly.clinics)."
}
variable "zone_name" {
  type        = string
  description = "Route 53 zone that holds fqdn (for example test.kiorly.com). Must already exist and be delegated."
}
variable "legacy_distribution_domain" {
  type        = string
  description = "Domain name of the LIVE Clinic CloudFront distribution (CDK-managed, never changed here). The new host serves the SPA through it."
}
variable "apprunner_domain" {
  type        = string
  description = "Default domain of the Clinic App Runner service (origin of /api/* and /marketplace/*)."
}
variable "price_class" {
  type    = string
  default = "PriceClass_100"
}
variable "noindex" {
  type        = bool
  default     = true
  description = "Send X-Robots-Tag noindex (every non-production environment)."
}
variable "api_paths" {
  type        = list(string)
  default     = ["/api/*", "/marketplace/*"]
  description = "Path patterns routed to App Runner. /marketplace/* is the signed Kiorex partner API (outside /api/v1 by contract)."
}
variable "enable_egress" {
  type        = bool
  default     = true
  description = "Give the Clinic App Runner VPC connector a path to the public internet (Passport, Kiorex API). See README."
}
variable "clinic_vpc_name" {
  type    = string
  default = "kiorly-clinics-management/Vpc"
}
variable "egress_cidr" {
  type        = string
  default     = "10.1.0.0/28"
  description = "Secondary CIDR of the Clinic VPC for the NAT subnet (the primary /16 is fully allocated by the CDK subnets)."
}
variable "egress_az" {
  type    = string
  default = "eu-central-1a"
}
variable "egress_gateway_enabled" {
  type        = bool
  default     = true
  description = "Keep the managed NAT gateway (about 36 USD per month). Set false only after the NAT instance is verified."
}
variable "egress_instance_enabled" {
  type        = bool
  default     = false
  description = "Create the NAT instance (t4g.nano, Elastic IP, recovery alarms)."
}
variable "egress_route_via" {
  type        = string
  default     = "gateway"
  description = "Which egress the two public route tables use: gateway or instance."
  validation {
    condition     = contains(["gateway", "instance"], var.egress_route_via)
    error_message = "egress_route_via must be gateway or instance."
  }
}
variable "egress_instance_type" {
  type    = string
  default = "t4g.nano"
}
