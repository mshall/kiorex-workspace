output "certificate_arns" {
  description = "domain key => SCM certificate id (empty string when no certificate with the expected name exists yet)."
  value       = { for k, d in data.huaweicloud_scm_certificates.this : k => try(d.certificates[0].id, "") }
}
