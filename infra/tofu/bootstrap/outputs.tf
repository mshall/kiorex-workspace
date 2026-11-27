output "state_bucket" {
  value = local.bucket
}
output "backend_hcl" {
  description = "Paste into envs/<env>/backend.hcl (key differs per environment)."
  value       = local.on_aws ? "bucket = \"${local.bucket}\"\nregion = \"${var.aws_region}\"\nencrypt = true\nuse_lockfile = true\n" : "bucket = \"${local.bucket}\"\n# OBS S3-compatible endpoint settings: see envs/*/backend.hcl.example\n"
}
