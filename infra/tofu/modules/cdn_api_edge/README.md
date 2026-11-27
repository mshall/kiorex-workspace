# cdn_api_edge

APIs, gateway and IdP behind the CDN. The origin accepts only requests that carry the origin-secret header; the host security group accepts only the CDN.

Same interface on both providers: `cdn_api_edge/aws` and `cdn_api_edge/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, services (fqdn, certificate_key), origin_domains, origin_port, origin_secret, enable_custom_domains, certificate_arns, price_class, noindex, waf_enabled, waf_rate_limit, region

**Outputs:** distributions: id => { distribution_id, arn, domain_name, hosted_zone_id, default_url }, web_acl_arn

**AWS:** One CloudFront distribution per service, caching disabled, AllViewerExceptHostHeader, headers X-Origin-Secret and X-Kx-Service, optional WAF (rate limit + AWS common rules).

**Huawei (validated with `tofu validate` only, never applied):** One CDN domain per service with retrieval request headers X-Origin-Secret and X-Kx-Service. No WAF here (enable Cloud WAF in the console).
