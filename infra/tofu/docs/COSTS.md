# Cost notes (estimates, not quotes)

Basis: eu-central-1 list prices recalled by the author and rounded, 730 hours per month, on-demand, no savings plans, low traffic, USD. These are NOT taken from a live price list and must be checked in the AWS Pricing Calculator and, after the first month, in Billing (cost allocation tag `EnvTag`). Huawei Cloud is not priced.

## kx-test (AWS), what the 90 planned resources cost

| Item | Basis | USD / month |
|---|---|---|
| EC2 t4g.medium | about 0.038 per hour | 28 |
| Root volume 30 GB gp3 | about 0.096 per GB | 2.9 |
| Data volume 20 GB gp3 | same | 1.9 |
| Daily snapshots, 7 kept | incremental, a few GB | 1 |
| Public IPv4 for the Elastic IP | 0.005 per hour | 3.7 |
| CloudFront, 7 distributions | always-free tier covers 1 TB and 10 M requests; PriceClass_100 | 0 to 2 |
| S3: 4 site buckets, backups, deploy | small, versioned | 1 |
| ECR: 4 repositories, 15 images each | about 0.10 per GB | 1 to 2 |
| Route 53: 2 zones | 0.50 per zone plus queries | 1 |
| Secrets Manager: 6 secrets | 0.40 each | 2.4 |
| CloudWatch alarms, SNS, budget | first 10 alarms and 2 budgets are free | 0 to 1 |
| ACM, SSM, DLM, IAM, VPC endpoint (S3 gateway) | free | 0 |
| **Total** | | **about 45 (42 to 52)** |

Not included: data transfer to the internet beyond the free tier, AI provider calls, SMS and e-mail providers, domain renewals. No NAT gateway and no interface endpoints exist in this design (the live Clinic account pays about 50 for three interface endpoints; this stack avoids them).

Ways to lower it: t4g.small (about 14 less, tight with five Node processes), a one-year compute savings plan (about 30 to 40 percent of the host line), stopping the host out of hours is NOT recommended while the real clinic uses test.

## kx-pilot (AWS) about 95

Host t4g.large 56, disks 13 (60 GB data, 40 GB root, 14 snapshots), Elastic IP 4, WAF 8 to 10 (web ACL, two rules, requests), CDN 2 to 10, storage 2, ECR 2, DNS 1, secrets 2.4, alarms 2.

## kx-pro

On Huawei: not priced; use the Huawei price calculator for the chosen region and the flavors in `envs/prod/terraform.tfvars`. AWS fallback (`aws.tfvars.example`) about 320: t4g.xlarge 112, RDS db.t4g.medium Multi-AZ with 100 GB 125 to 150, disks 10, Elastic IP 4, WAF 8 to 10, CDN 10 to 40, storage and registry 5, DNS, secrets and alarms 6.
