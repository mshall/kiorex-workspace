# UNVERIFIED AT RUNTIME. Huawei SCM does not issue free certificates through the provider, and importing one would put the private key in
# OpenTofu state. So this module only LOOKS UP certificates the founder bought or imported in the console (SCM), named
# "<name_prefix>-<domain key>" (for example kx-prod-kiorex), and hands their ids to the CDN module.
data "huaweicloud_scm_certificates" "this" {
  for_each = var.certificates
  name     = "${var.name_prefix}-${each.key}"
}
