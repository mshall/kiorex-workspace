# budget_alarm

Monthly budget with e-mail thresholds.

Same interface on both providers: `budget_alarm/aws` and `budget_alarm/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, env_tag, monthly_limit_usd, emails, thresholds_percent, scope

**Outputs:** budget_name, note

**AWS:** AWS Budgets, optional filter on the EnvTag cost allocation tag.

**Huawei (validated with `tofu validate` only, never applied):** Not available in the provider: creates nothing, outputs the manual step.
