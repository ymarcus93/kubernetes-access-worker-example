output "worker_hostname" {
  description = "Worker hostname"
  value       = cloudflare_workers_custom_domain.worker_domain.hostname
}

output "wvpc_service_id" {
  description = "WVPC service ID"
  value       = cloudflare_connectivity_directory_service.kube_wvpc_service.id
}

output "access_aud" {
  description = "Access Application (AUD) Tag"
  value       = cloudflare_zero_trust_access_application.worker_access_app.aud
}