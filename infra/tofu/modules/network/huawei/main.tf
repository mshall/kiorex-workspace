data "huaweicloud_availability_zones" "this" {}

locals {
  azs = slice(sort(data.huaweicloud_availability_zones.this.names), 0, var.az_count)
}

resource "huaweicloud_vpc" "this" {
  name = "${var.name_prefix}-vpc"
  cidr = var.vpc_cidr
  tags = var.tags
}

resource "huaweicloud_vpc_subnet" "public" {
  count             = var.az_count
  name              = "${var.name_prefix}-public-${count.index}"
  vpc_id            = huaweicloud_vpc.this.id
  cidr              = cidrsubnet(var.vpc_cidr, 4, count.index)
  gateway_ip        = cidrhost(cidrsubnet(var.vpc_cidr, 4, count.index), 1)
  availability_zone = local.azs[count.index]
  tags              = var.tags
}

# Isolated tier for a managed database. Huawei VPC subnets have no internet route unless an EIP or NAT gateway is attached,
# so a subnet without either is isolated; nothing here creates one.
resource "huaweicloud_vpc_subnet" "private" {
  count             = var.create_private_subnets ? max(var.az_count, 2) : 0
  name              = "${var.name_prefix}-private-${count.index}"
  vpc_id            = huaweicloud_vpc.this.id
  cidr              = cidrsubnet(var.vpc_cidr, 4, 8 + count.index)
  gateway_ip        = cidrhost(cidrsubnet(var.vpc_cidr, 4, 8 + count.index), 1)
  availability_zone = sort(data.huaweicloud_availability_zones.this.names)[count.index % length(data.huaweicloud_availability_zones.this.names)]
  tags              = var.tags
}
