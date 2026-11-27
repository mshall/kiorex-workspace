output "zone_ids" { value = { for k, z in huaweicloud_dns_zone.this : k => z.id } }
output "name_servers" {
  description = "Give these to the registrar as NS records for the child zone (founder action)."
  value       = { for k, z in huaweicloud_dns_zone.this : k => { zone = z.name, ns = [for n in data.huaweicloud_dns_zone_nameservers.this[k].nameservers : n.hostname] } }
}
