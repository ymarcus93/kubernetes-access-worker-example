output "namespace" {
  description = "Namespace where cloudflared is deployed"
  value       = kubernetes_namespace_v1.cloudflared.metadata[0].name
}

output "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  value       = cloudflare_zero_trust_tunnel_cloudflared.tunnel.id
}

output "tunnel_name" {
  description = "Cloudflare Tunnel name"
  value       = cloudflare_zero_trust_tunnel_cloudflared.tunnel.name
}