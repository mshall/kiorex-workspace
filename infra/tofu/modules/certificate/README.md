# certificate

One certificate per environment and domain (`<env>.<domain>` and `*.<env>.<domain>`; prod `<domain>` and `*.<domain>`). Never a shared wildcard.

Same interface on both providers: `certificate/aws` and `certificate/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, certificates, zone_ids, wait_for_validation

**Outputs:** certificate_arns

**AWS:** ACM in us-east-1 (provider alias `aws.us_east_1`), DNS validation records in the zone, validation waiter.

**Huawei (validated with `tofu validate` only, never applied):** Looks up SCM certificates named `<name_prefix>-<domain key>` that the founder bought or imported (no private key in state).
