data "aws_availability_zones" "this" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.this.names, 0, var.az_count)
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

# Hygiene: the default security group allows nothing.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-default-deny" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  map_public_ip_on_launch = false # the host gets an Elastic IP explicitly
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-public-${local.azs[count.index]}", Tier = "public" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name_prefix}-public" })
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_subnet" "private" {
  count             = var.create_private_subnets ? max(var.az_count, 2) : 0
  vpc_id            = aws_vpc.this.id
  availability_zone = data.aws_availability_zones.this.names[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, 8 + count.index)
  tags              = merge(var.tags, { Name = "${var.name_prefix}-private-${count.index}", Tier = "isolated" })
}

resource "aws_route_table" "private" {
  count  = var.create_private_subnets ? 1 : 0
  vpc_id = aws_vpc.this.id # no routes except local: the data tier cannot reach or be reached from the internet
  tags   = merge(var.tags, { Name = "${var.name_prefix}-private" })
}

resource "aws_route_table_association" "private" {
  count          = var.create_private_subnets ? max(var.az_count, 2) : 0
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

# Free gateway endpoint: backups and deploy artifacts to S3 do not cross the internet.
data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat([aws_route_table.public.id], aws_route_table.private[*].id)
  tags              = merge(var.tags, { Name = "${var.name_prefix}-s3" })
}
