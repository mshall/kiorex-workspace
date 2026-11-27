# UNVERIFIED AT RUNTIME: validated with `tofu validate` only. Verify flavors, volume types and CBR vault sizing in the console.
data "huaweicloud_availability_zones" "this" {}

resource "huaweicloud_kms_key" "data" {
  key_alias        = "${var.name_prefix}-data"
  key_description  = "Encrypts the ${var.name_prefix} data volume and backups"
  rotation_enabled = true
  pending_days     = "30"
  tags             = var.tags
}

# ---------------------------------------------------------------- backups bucket (both modes)
resource "huaweicloud_obs_bucket" "backup" {
  bucket        = var.backup_bucket_name
  acl           = "private"
  storage_class = "STANDARD"
  encryption    = true
  sse_algorithm = "kms"
  kms_key_id    = huaweicloud_kms_key.data.id
  versioning    = true
  force_destroy = false
  tags          = var.tags
  lifecycle_rule {
    name    = "expire-dumps"
    enabled = true
    prefix  = "dumps/"
    expiration { days = var.backup_retention_days }
    noncurrent_version_expiration { days = 7 }
  }
}

# ---------------------------------------------------------------- host mode: separate encrypted data volume + daily backup policy
resource "huaweicloud_evs_volume" "data" {
  count             = var.mode == "host" ? 1 : 0
  name              = "${var.name_prefix}-data"
  availability_zone = var.availability_zone
  volume_type       = "GPSSD"
  size              = var.data_volume_gb
  kms_id            = huaweicloud_kms_key.data.id
  tags              = var.tags
  lifecycle {
    prevent_destroy = true
  }
}

resource "huaweicloud_compute_volume_attach" "data" {
  count       = var.mode == "host" ? 1 : 0
  instance_id = var.primary_instance_id
  volume_id   = huaweicloud_evs_volume.data[0].id
}

resource "huaweicloud_cbr_policy" "daily" {
  count           = var.mode == "host" ? 1 : 0
  name            = "${var.name_prefix}-daily"
  type            = "backup"
  backup_quantity = var.snapshot_retention_days
  time_zone       = "UTC+00:00"
  backup_cycle {
    days            = "MO,TU,WE,TH,FR,SA,SU"
    execution_times = ["02:15"]
  }
}

resource "huaweicloud_cbr_vault" "data" {
  count            = var.mode == "host" ? 1 : 0
  name             = "${var.name_prefix}-data"
  type             = "disk"
  protection_type  = "backup"
  consistent_level = "crash_consistent"
  size             = var.data_volume_gb * 2
  auto_expand      = false
  tags             = var.tags
  policy {
    id = huaweicloud_cbr_policy.daily[0].id
  }
  resources {
    includes = [huaweicloud_evs_volume.data[0].id]
  }
}

# ---------------------------------------------------------------- managed mode: private RDS for PostgreSQL
resource "huaweicloud_networking_secgroup" "db" {
  count                = var.mode == "managed" ? 1 : 0
  name                 = "${var.name_prefix}-db"
  description          = "PostgreSQL from the host only"
  delete_default_rules = true
}
resource "huaweicloud_networking_secgroup_rule" "db_from_host" {
  count             = var.mode == "managed" ? 1 : 0
  security_group_id = huaweicloud_networking_secgroup.db[0].id
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 5432
  port_range_max    = 5432
  remote_group_id   = var.host_security_group_id
}
resource "huaweicloud_rds_instance" "this" {
  count             = var.mode == "managed" ? 1 : 0
  name              = "${var.name_prefix}-pg"
  flavor            = var.managed_instance_class
  availability_zone = [sort(data.huaweicloud_availability_zones.this.names)[0]]
  vpc_id            = var.vpc_id
  subnet_id         = var.private_subnet_ids[0]
  security_group_id = huaweicloud_networking_secgroup.db[0].id
  ssl_enable        = true
  secret_name       = var.managed_password_secret_name
  tde_enabled       = false # PostgreSQL TDE is not offered; the volume is KMS-encrypted below
  tags              = var.tags
  db {
    type    = "PostgreSQL"
    version = var.engine_version
  }
  volume {
    type               = "CLOUDSSD"
    size               = var.managed_storage_gb
    disk_encryption_id = huaweicloud_kms_key.data.id
  }
  backup_strategy {
    start_time = "01:00-02:00"
    keep_days  = var.managed_backup_days
  }
}

# Non-secret connection facts for the host (host name and port only).
resource "huaweicloud_csms_secret" "dbconn" {
  count       = var.mode == "managed" ? 1 : 0
  name        = "${replace(trimprefix(var.secrets_prefix, "/"), "/", "-")}-dbconn"
  secret_text = jsonencode({ host = huaweicloud_rds_instance.this[0].private_ips[0], port = 5432 })
  tags        = var.tags
}
