# network

VPC, public subnet(s) for the host, optional isolated subnets for a managed database. No NAT gateway, ever (cost).

Same interface on both providers: `network/aws` and `network/huawei` take the same variables and return the same outputs, so the stack can switch cloud with one variable (`provider_name`).

**Inputs:** name_prefix, tags, vpc_cidr, az_count, create_private_subnets, region

**Outputs:** vpc_id, vpc_cidr, public_subnet_ids, private_subnet_ids, availability_zones

**AWS:** VPC + internet gateway + public route table, isolated private subnets (no route out), free S3 gateway endpoint, default security group with no rules.

**Huawei (validated with `tofu validate` only, never applied):** VPC + subnets. Isolation of the private tier comes from not attaching an EIP or NAT gateway.
