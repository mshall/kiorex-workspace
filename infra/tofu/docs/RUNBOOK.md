# Runbook (kx-test, kx-pilot, kx-pro)

Everything below is a procedure to be executed by the founder or an agent the founder instructs. Nothing has been executed. AWS commands use `--profile` of the account of the environment; replace `<env>` with `test`, `pilot` or `prod` and `<tag>` with `kx-test`, `kx-pilot` or `kx-pro`.

## 1. First time, in order

1. Fill the placeholders you own (pilot AWS account id, Huawei region only if used, `alert_emails`).
2. `bootstrap/`: create the state bucket (README quick start step 1).
3. `envs/<env>`: `tofu init -backend-config=backend.hcl`, `tofu plan -out`, review, `tofu apply` (founder).
4. Read the outputs: `tofu output deploy`, `tofu output name_servers`, `tofu output default_urls`.
5. Secrets (section 4), GitHub (section 11), first deploy (section 5), smoke test (section 6).
6. Restore drill (section 7) before any real traffic beyond the existing clinic.

## 2. Day-to-day OpenTofu rules

- Always `tofu plan` and read it. A plan that wants to replace or destroy `aws_instance`, `aws_ebs_volume`, `aws_db_instance`, a state or backup bucket is a stop sign.
- One person applies at a time (lock file). Never run apply from CI for pilot or prod; plan only.
- The Clinic is never in this state. If a plan ever mentions `E1DE0H2K3M17YL` as anything other than a data source, stop.

## 3. Access

- AWS: `aws ssm start-session --target <instance id>` (Session Manager, no SSH). Instance ids: `tofu output -json deploy | jq -r .instance_ids[]`.
- Huawei: the ECS console VNC (no SSH rule exists). Open port 22 only for a time-boxed fix and remove it again.
- Logs: `docker compose -p kx-<env> logs --since 1h <service>` from `/opt/kx/releases/current` (journal for `kx.service`, `kx-backup.service`).

## 4. Secrets

The secret store holds JSON objects named `<prefix>/<name>` (prefix `/kx/<env>`; on Huawei `kx-<env>-<name>`). Names: one per product database (`platform`, `passport`, `pharmacy`, `lab`), plus `postgres`, `edge`, and (managed database mode) `dbconn`.

- `postgres`: generated on the host at the first deploy (`kx-init-secrets.sh`). Do not write it.
- `edge`: written by OpenTofu (the origin header, the documented exception).
- `platform`, `passport`, `pharmacy`, `lab`: set by the founder. Format: a flat JSON object `{ "ENV_VAR_NAME": "value", ... }` with the variable names taken from each product's `.env.example` (OIDC keys, signing keys, provider keys). URL variables are injected from the registry automatically; do not add them. `DATABASE_URL` is injected too. Multi-line values: store with `\n` escapes and decode in the product, or use a `_B64` suffix variable if the product supports it (check before the first apply).

```bash
aws secretsmanager put-secret-value --secret-id /kx/<env>/passport --secret-string file://passport.json   # file outside the repo, delete after
```
Huawei: `hcloud CSMS CreateSecretVersion --secret_name=kx-<env>-passport --version.secret_string=...` or the console.

Managed database mode only: the host cannot create roles in a managed instance. Connect once with the master secret from a session on the host and create one role and one database per product (the same statements as `deploy/host/kx-pg-reconcile.sh`), then store each password in the `postgres` secret as `<product>_password`.

## 5. Deploy and rollback

- Normal: the reusable workflow builds the image, pushes `<registry>/<image>:<git sha>`, runs `deploy.sh`.
- By hand: `KX_REGISTRY=<registry_url> infra/tofu/deploy/scripts/deploy.sh <env> --tag platform=<sha> --tag passport=<sha> --tag pharmacy-api=<sha> --tag lab-api=<sha>` (first deploy needs all four; later only the changed one).
- `--dry-run` builds the bundle and prints the release without uploading. `KX_OFFLINE=1` never contacts the cloud.
- Rollback: `deploy.sh <env> --rollback` promotes `releases/previous` to `releases/current` in object storage and applies it (images are still in the registry). Database migrations are not reversed: for a bad migration restore from a dump (section 7).
- What a deploy does on the host: sync the release, generate the env files, log in to the registry, start PostgreSQL (host mode) and reconcile roles, `docker compose up -d --wait`, prune old images. `platform-jobs` is started on host 0 only and never scaled.
- Static sites (marketplace, ops console, pharmacy web, lab web): `reusable-static-deploy.yml` or `aws s3 sync <dist> s3://<bucket from tofu output deploy.static_buckets> --delete` then a CloudFront invalidation.

## 6. Smoke test

Before custom domains use `tofu output default_urls`. For an API: `curl -s -o /dev/null -w '%{http_code}\n' https://<default url>/api/v1/health/live` (platform), `/healthz` (Passport). A request that bypasses the CDN must fail: `curl -m 5 http://<origin_domains[0]>/` must time out (security group) and with the right IP but no header, Caddy answers 403.

## 7. Backups and the restore drill

- Daily at 01:30 UTC `kx-backup.service` dumps every database to `s3://<backup bucket>/dumps/<env>/<db>/<date>.sql.gz`; the `BackupOk` metric feeds an alarm that fires if a day is missed. Dumps expire after `backup_retention_days`.
- Daily at 02:15 UTC the snapshot policy snapshots the data volume (7 days test, 14 pilot).
- Drill (quarterly, and once before real use): `deploy/host/kx-restore-drill.md`. A backup that was never restored is not a backup.
- Whole-volume restore from a snapshot: create a volume from the snapshot in the same AZ, stop the stack (`docker compose down`), detach the old volume, attach the new one at `/dev/sdf` (remember the old volume's `prevent_destroy` in OpenTofu: import the replacement or edit the state deliberately), start the stack.

## 8. Host replacement (failed host, new AMI, resize)

1. Take a manual snapshot of the data volume.
2. `tofu apply -replace='module.stack.module.compute_host_aws[0].aws_instance.host[0]'` (Huawei: `module.compute_host_huawei[0].huaweicloud_compute_instance.host[0]`). The Elastic IP, security group and role stay; the data volume attaches to the new host.
3. The new host mounts the existing filesystem (it never formats a volume that already has one), fetches the current release and starts. Check section 6.
4. Resize: change `compute.instance_type`; `ignore_changes` covers AMI and user data only, so a type change is an in-place stop/start.
5. `ignore_changes` on `user_data` means edited bootstrap scripts do not reach a running host by apply: the next deploy ships `deploy/host/*` only on instance creation. To update the host scripts on a running host, replace the host (this section) or copy the script through a Session Manager session.

## 9. Deliberate destroy (decommission)

The data volume has `prevent_destroy = true`, the buckets have `force_destroy = false`, the managed database has deletion protection. To retire an environment: confirm the founder's written decision, take a final snapshot and a final dump, copy them to a safe place, remove the lifecycle block and deletion protections in a reviewed change, then `tofu destroy`. Never for test while the real clinic organisation uses it.

## 10. Rotating the origin secret

`tofu apply -replace=module.stack.random_password.origin` regenerates the value. CloudFront updates in a few minutes and the `edge` secret changes at once; the host has the old value until its env files are rendered again. Run a deploy (section 5, which re-renders `edge.env` and recreates Caddy) immediately after the apply. Expect a short window of 403 for API calls: do it at a quiet time, and tell the one real clinic first.

## 11. GitHub (founder)

Per product repo (kiorex-platform, kiorex-account, kiorly-pharmacy, kiorly-lab): create Environments `test`, `pilot`, `prod`; reviewers required on pilot and prod. Environment variables: `AWS_ROLE_ARN` (`tofu output -json deploy | jq -r .ci_role_arn`), `AWS_REGION`, `KX_REGISTRY` (`.registry_url`), `DEPLOY_BUCKET`, `SSM_DOCUMENT`. Secret `INFRA_REPO_TOKEN` (read-only token for the repo that contains `infra/tofu/deploy`). The OIDC trust is limited to `repo:<owner>/<repo>:environment:<env>`, so a job only gets the role when it runs in that GitHub Environment. Huawei (interim): a push-only IAM user, its keys as environment secrets `HUAWEI_AK`, `HUAWEI_SK`.

Do not enable a workflow that pushes to the Clinic's `main`; the Clinic keeps its own workflow and its `[skip ci]` rule.

## 12. Huawei notes

- Apex host: Huawei DNS does not accept a CNAME at the zone apex. For `test.kiorex.com` style apex hosts either serve the marketplace from a sub-host and redirect the apex, or use the console feature that Huawei documents for apex acceleration. Not automated here.
- Region, service area of the CDN, flavors and image names must be looked up in the console for the chosen region (the modules take them as variables or discover by size).
- Certificates: buy or import in SCM with the name `<tag>-<domain key>`; the module only looks them up, so the private key never enters state.
- Back-to-origin IP ranges for `origin_allow_cidrs`: take them from the CDN console or API, review them monthly.
- Remote state may stay in the AWS bucket (locked) even when the environment runs on Huawei.

## 13. Alarms and who gets them

E-mail recipients confirm the SNS subscription once (two topics on AWS: regional and us-east-1). Alarms: host status check (also auto-recovery), CPU, CPU credits, missing or failed backup, CDN 5xx per distribution, managed database storage. Not covered: disk space on the host (needs the CloudWatch agent), application errors, certificate expiry (ACM renews by itself while the validation record exists: do not delete it).

## 14. Troubleshooting

| Symptom | Check |
|---|---|
| 403 from the CDN host name | Caddy rejects the origin secret: the `edge` secret and the CDN header differ (section 10) |
| 502 or 504 from the CDN | host security group (prefix list), container health (`docker compose ps`), `kx.service` journal |
| Host starts, nothing runs | no release uploaded yet: run the first deploy; `journalctl -u kx.service` |
| Containers cannot reach the database | `postgres` unhealthy, roles missing (`kx-pg-reconcile.sh`), wrong `DATABASE_URL` variable name in the product |
| ACM stays pending | NS records not added at the registrar, or the zone was recreated (new NS values) |
| Budget shows zero | the `EnvTag` cost allocation tag is not activated in Billing |
| `tofu plan` wants to replace the instance | AMI or user data drift is ignored by design; a real replacement means a changed subnet, type family or key: stop and read |
