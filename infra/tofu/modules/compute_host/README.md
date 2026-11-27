# compute_host

The single cost-minimal host that runs docker compose (platform API and jobs, Passport, Pharmacy API, Lab API, Caddy, optionally PostgreSQL). ARM by default. No SSH key, no SSH rule.

Same interface on both providers: `compute_host/aws` and `compute_host/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, env, region, vpc_id, subnet_ids, host_count (1), arch, instance_type, vcpus, memory_gb, root_volume_gb, kms_key_id, cdn_ingress, origin_allow_cidrs, key_pair, deploy_mode, deploy_bucket_name, backup_bucket_name, secrets_prefix, registry_url, ecr_repository_prefix, databases, database_mode, host_files, origin_port

**Outputs:** instance_ids, primary_instance_id, primary_availability_zone, origin_domains, origin_port, security_group_id, role_name, role_arn, deploy_bucket, deploy_bucket_arn, deploy_document, public_ips

**AWS:** Ubuntu 24.04 arm64 AMI from the Canonical SSM parameter, IMDSv2 only with hop limit 1, encrypted gp3 root, Elastic IP, instance role (SSM core, scoped secrets read, deploy bucket read, ECR pull, metric put), security group: origin port from the CloudFront origin-facing prefix list only, deploy bucket, SSM document `<prefix>-deploy` that can only run kx-deploy.sh.

**Huawei (validated with `tofu validate` only, never applied):** ECS + EIP + security group (origin port from `origin_allow_cidrs` only, empty = closed), OBS deploy bucket, agency for secret and object access. Pull-based deploy (the host polls OBS). Flavor picked by vcpus and memory when `instance_type` is empty.
