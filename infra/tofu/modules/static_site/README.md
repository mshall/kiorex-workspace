# static_site

One web app per registry service: static bundle in object storage behind the CDN, optional same-origin `/api/*` to the host.

Same interface on both providers: `static_site/aws` and `static_site/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, sites (fqdn, certificate_key, api_service), origin_domains, origin_port, origin_secret, enable_custom_domains, certificate_arns, price_class, noindex, web_acl_arn, region

**Outputs:** sites: id => { distribution_id, arn, domain_name, hosted_zone_id, default_url, bucket }

**AWS:** Private S3 bucket (SSE, versioning, TLS-only) + CloudFront with origin access control, SPA rewrite function on the default behavior only, security headers, `/api/*` behavior with origin-secret header.

**Huawei (validated with `tofu validate` only, never applied):** Public-read OBS bucket (assets only, documented difference) + Huawei CDN domain (custom domain required) with flexible origin for /api.
