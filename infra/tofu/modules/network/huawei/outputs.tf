output "vpc_id" { value = huaweicloud_vpc.this.id }
output "vpc_cidr" { value = huaweicloud_vpc.this.cidr }
# Huawei instances attach to the subnet's network id (neutron id), not the VPC subnet id.
output "public_subnet_ids" { value = huaweicloud_vpc_subnet.public[*].id }
output "private_subnet_ids" { value = huaweicloud_vpc_subnet.private[*].id }
output "availability_zones" { value = local.azs }
