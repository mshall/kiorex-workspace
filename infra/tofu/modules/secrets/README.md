# secrets

Secret containers only. Values are set by the founder or generated on the host; they are never in tfvars or state. One documented exception: the CDN origin header.

Same interface on both providers: `secrets/aws` and `secrets/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, secrets_prefix, names, kms_key_id, recovery_window_days, edge_secret_value, set_edge_secret

**Outputs:** secret_names, secret_arns, prefix

**AWS:** Secrets Manager secrets `<prefix>/<name>` (no version), edge secret version.

**Huawei (validated with `tofu validate` only, never applied):** CSMS secrets named `<prefix>-<name>` with `/` replaced by `-`.
