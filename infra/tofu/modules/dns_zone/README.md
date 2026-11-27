# dns_zone

DNS child zones (non-prod) or apex zones (prod) and the CDN records, both generated from the registry.

Same interface on both providers: `dns_zone/aws` and `dns_zone/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, zones, cdn_records

**Outputs:** zone_ids, name_servers

**AWS:** Route 53 public zones, A and AAAA alias records to the distributions.

**Huawei (validated with `tofu validate` only, never applied):** Huawei DNS public zones, CNAME records. A CNAME cannot sit at the zone apex: the environment apex host needs the console workaround in RUNBOOK.
