# database

PostgreSQL that is NEVER publicly reachable. Mode `host`: container on the host with data on a separate encrypted volume plus daily snapshot policy. Mode `managed`: private managed instance. Both: encrypted backup bucket with lifecycle, one database per product.

Same interface on both providers: `database/aws` and `database/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, env, region, mode, vpc_id, private_subnet_ids, host_security_group_id, host_role_name, primary_instance_id, availability_zone, databases, data_volume_gb, snapshot_retention_days, backup_bucket_name, backup_retention_days, kms_key_id, secrets_prefix, managed_instance_class, managed_storage_gb, managed_multi_az, managed_backup_days, engine_version, managed_password_secret_name (Huawei)

**Outputs:** mode, db_host, db_port, backup_bucket, backup_bucket_arn, data_volume_id, master_secret_arn

**AWS:** EBS gp3 encrypted data volume (prevent_destroy), DLM daily snapshots, S3 backup bucket (SSE, versioning, TLS-only, public block, expiry), host role policy to write dumps; managed: RDS PostgreSQL private, encrypted, manage_master_user_password (password in Secrets Manager, never in state), deletion protection, final snapshot.

**Huawei (validated with `tofu validate` only, never applied):** EVS volume encrypted with a KMS key (prevent_destroy), CBR vault + daily policy, OBS backup bucket with KMS and lifecycle; managed: RDS for PostgreSQL private, SSL on, password from a CSMS secret you create.
