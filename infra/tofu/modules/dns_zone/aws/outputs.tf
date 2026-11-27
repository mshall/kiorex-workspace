output "zone_ids" { value = { for k, z in aws_route53_zone.this : k => z.zone_id } }
output "name_servers" {
  description = "Give these to the registrar as NS records for the child zone (founder action)."
  value       = { for k, z in aws_route53_zone.this : k => { zone = z.name, ns = z.name_servers } }
}
