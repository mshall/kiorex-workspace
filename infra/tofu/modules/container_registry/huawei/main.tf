# UNVERIFIED AT RUNTIME. SWR organisation + repositories. GitHub-to-Huawei federation (OIDC identity provider + agency) is NOT created here:
# the interim CI path is a push-only IAM user whose AK/SK are GitHub Environment secrets (see RUNBOOK section 11).
resource "huaweicloud_swr_organization" "this" {
  name = var.name_prefix
}

resource "huaweicloud_swr_repository" "this" {
  for_each     = toset(var.images)
  organization = huaweicloud_swr_organization.this.name
  name         = each.value
  category     = "app_server"
  is_public    = false
}
