output "namespace" {
  description = "Namespace where cloudflared is deployed"
  value       = module.k8s.namespace
}

output "tunnel_id" {
  description = "Cloudflare Tunnel ID"
  value       = module.k8s.tunnel_id
}

output "tunnel_name" {
  description = "Cloudflare Tunnel name"
  value       = module.k8s.tunnel_name
}

output "worker_hostname" {
  description = "Worker hostname"
  value       = module.worker.worker_hostname
}

output "wvpc_service_id" {
  description = "WVPC service ID"
  value       = module.worker.wvpc_service_id
}

output "access_aud" {
  description = "Access Application (AUD) Tag"
  value       = module.worker.access_aud
}