# stack

The composition used by every environment root (`envs/test`, `envs/pilot`, `envs/prod`). It holds the provider switch: every capability is instantiated twice, `<capability>_aws` and `<capability>_huawei`, with `count` driven by `provider_name`; outputs are merged with `try()`. Switching an environment between clouds is therefore one variable, not a rewrite.

Wiring, in order: registry, network, container registry, secrets, compute host, database, DNS zones, certificates, API edge, static sites, budget and alarms, read-only reference to the live Clinic.

`enable_custom_domains = false` (default) creates no certificates, no records and no aliases: everything answers on default CDN host names. `true` adds certificates, validation records, aliases and records generated from the registry.
