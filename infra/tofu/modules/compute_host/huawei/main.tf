# UNVERIFIED AT RUNTIME: validated with `tofu validate` only. Verify region, flavors, image and CDN origin IP ranges before the first apply.
data "huaweicloud_availability_zones" "this" {}

data "huaweicloud_compute_flavors" "auto" {
  count             = var.instance_type == "" ? 1 : 0
  performance_type  = "normal"
  cpu_core_count    = var.vcpus
  memory_size       = var.memory_gb
  availability_zone = sort(data.huaweicloud_availability_zones.this.names)[0]
}

data "huaweicloud_images_images" "ubuntu" {
  name_regex   = var.arch == "arm64" ? "^Ubuntu 24.04.*ARM.*" : "^Ubuntu 24.04 server 64bit.*"
  visibility   = "public"
  architecture = var.arch == "arm64" ? "arm" : "x86"
  sort_key     = "created_at"
}

locals {
  flavor      = var.instance_type != "" ? var.instance_type : data.huaweicloud_compute_flavors.auto[0].ids[0]
  azs         = sort(data.huaweicloud_availability_zones.this.names)
  files       = { for n, c in var.host_files : n => base64gzip(c) }
  cli_install = "curl -fsSL https://hcloudcli.obs.cn-north-1.myhuaweicloud.com/cli/latest/hcloud_install.sh -o /tmp/hcloud_install.sh && bash /tmp/hcloud_install.sh -y; curl -fsSL https://obs-community.obs.cn-north-1.myhwclouds.com/obsutil/current/obsutil_linux_$(dpkg --print-architecture).tar.gz -o /tmp/obsutil.tgz && tar -xzf /tmp/obsutil.tgz -C /tmp && install -m 0755 /tmp/obsutil_linux_*/obsutil /usr/local/bin/obsutil"
}

# ---------------------------------------------------------------- deploy artifacts (OBS, private, encrypted, versioned)
resource "huaweicloud_obs_bucket" "deploy" {
  bucket        = var.deploy_bucket_name
  acl           = "private"
  storage_class = "STANDARD"
  encryption    = true # SSE-KMS with the default OBS key
  versioning    = true
  force_destroy = false
  tags          = var.tags
  lifecycle_rule {
    name    = "expire-old-releases"
    enabled = true
    prefix  = "releases/"
    noncurrent_version_expiration { days = 30 }
  }
}

# ---------------------------------------------------------------- identity: an agency lets the host read secrets/objects without stored keys
resource "huaweicloud_identity_agency" "host" {
  name                   = "${var.name_prefix}-host"
  description            = "ECS host: read CSMS secrets and OBS deploy artifacts (least privilege roles are listed in RUNBOOK; verify names in the IAM console)"
  delegated_service_name = "op_svc_ecs"
  project_role {
    project = var.region
    roles   = ["CSMS ReadOnlyAccess", "OBS OperateAccess"]
  }
}

# ---------------------------------------------------------------- network exposure
resource "huaweicloud_networking_secgroup" "host" {
  name                 = "${var.name_prefix}-host"
  description          = "Origin port from the CDN only. No SSH, no database port."
  delete_default_rules = true
}
resource "huaweicloud_networking_secgroup_rule" "cdn" {
  for_each          = toset(var.origin_allow_cidrs)
  security_group_id = huaweicloud_networking_secgroup.host.id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = var.origin_port
  port_range_max    = var.origin_port
  remote_ip_prefix  = each.value
}
resource "huaweicloud_networking_secgroup_rule" "egress" {
  security_group_id = huaweicloud_networking_secgroup.host.id
  direction         = "egress"
  ethertype         = "IPv4"
  remote_ip_prefix  = "0.0.0.0/0"
}

# ---------------------------------------------------------------- the host(s)
resource "huaweicloud_compute_instance" "host" {
  count                  = var.host_count
  name                   = "${var.name_prefix}-host-${count.index}"
  flavor_id              = local.flavor
  image_id               = data.huaweicloud_images_images.ubuntu.images[0].id
  availability_zone      = local.azs[count.index % length(local.azs)]
  security_group_ids     = [huaweicloud_networking_secgroup.host.id]
  agency_name            = huaweicloud_identity_agency.host.name
  key_pair               = var.key_pair == "" ? null : var.key_pair
  system_disk_type       = "GPSSD"
  system_disk_size       = var.root_volume_gb
  system_disk_kms_key_id = var.kms_key_id
  tags                   = merge(var.tags, { KxEnv = var.env })

  network {
    uuid = var.subnet_ids[count.index % length(var.subnet_ids)]
  }

  user_data = templatefile("${path.module}/../../../deploy/host/cloud-init.yaml.tftpl", {
    provider       = "huawei", env = var.env, region = var.region, deploy_bucket = var.deploy_bucket_name, backup_bucket = var.backup_bucket_name,
    secrets_prefix = var.secrets_prefix, registry_url = var.registry_url, db_mode = var.database_mode, databases = join(" ", var.databases),
    deploy_mode    = "poll", jobs_host = count.index == 0 ? "true" : "false", files = local.files, provider_cli_install = local.cli_install
  })

  lifecycle {
    ignore_changes = [image_id, user_data]
  }
}

resource "huaweicloud_vpc_eip" "host" {
  count = var.host_count
  name  = "${var.name_prefix}-host-${count.index}"
  publicip { type = "5_bgp" }
  bandwidth {
    share_type  = "PER"
    name        = "${var.name_prefix}-bw-${count.index}"
    size        = 10
    charge_mode = "traffic"
  }
  tags = var.tags
}

resource "huaweicloud_vpc_eip_associate" "host" {
  count      = var.host_count
  public_ip  = huaweicloud_vpc_eip.host[count.index].address
  network_id = huaweicloud_compute_instance.host[count.index].network[0].uuid
  fixed_ip   = huaweicloud_compute_instance.host[count.index].access_ip_v4
}
