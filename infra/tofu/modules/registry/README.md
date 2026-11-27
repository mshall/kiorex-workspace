# registry

Pure data module (no provider). Reads `_docs/registry/service-url-registry.yaml` with `yamldecode` and returns, for one environment and the list of services it deploys: host names (`<service>.<env>.<domain>`, production without the environment label), zone names, certificate names and the legacy hosts. This is the single source of truth: no host name is typed anywhere else in this tree.

Inputs: `registry_file`, `env_id`, `deploy_services`. Outputs: `env`, `hosts`, `zone_names`, `certificates`, `legacy_hosts`.
