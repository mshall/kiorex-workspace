# container_registry

One repository per image, scan on push, retention. On AWS also the GitHub OIDC role for CI.

Same interface on both providers: `container_registry/aws` and `container_registry/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, env, region, images, retention_count, kms_key_id, github_repos, create_github_oidc_provider, deploy_bucket_name, deploy_document_name, site_bucket_names, cloudfront_distribution_arns

**Outputs:** registry_url, repository_urls, ci_role_arn

**AWS:** ECR repos + lifecycle, OIDC provider (create or reference), CI role limited to: push to these repos, write releases/*, sync site buckets, invalidate, send the deploy document to hosts tagged for this environment.

**Huawei (validated with `tofu validate` only, never applied):** SWR organization + repositories. GitHub federation not created (interim push-only IAM user).
