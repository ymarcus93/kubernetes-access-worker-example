output "cluster_id" {
  description = "The ID of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.cluster.id
}

output "cluster_name" {
  description = "The name of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.cluster.name
}

output "cluster_endpoint" {
  description = "The endpoint for the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.cluster.endpoint
}

output "cluster_region" {
  description = "The region where the cluster is deployed"
  value       = digitalocean_kubernetes_cluster.cluster.region
}

output "cluster_version" {
  description = "The Kubernetes version"
  value       = digitalocean_kubernetes_cluster.cluster.version
}

output "cluster_token" {
  description = "The cluster authentication token"
  sensitive   = true
  value       = digitalocean_kubernetes_cluster.cluster.kube_config[0].token
}

output "cluster_ca_certificate" {
  description = "The cluster CA certificate"
  value       = digitalocean_kubernetes_cluster.cluster.kube_config[0].cluster_ca_certificate
}

output "kubeconfig" {
  description = "Raw kubeconfig for the cluster (use with kubectl)"
  value       = digitalocean_kubernetes_cluster.cluster.kube_config[0].raw_config
  sensitive   = true
}

output "node_pool_id" {
  description = "The ID of the default node pool"
  value       = digitalocean_kubernetes_cluster.cluster.node_pool[0].id
}

output "cluster_urn" {
  description = "The DigitalOcean URN of the cluster"
  value       = digitalocean_kubernetes_cluster.cluster.urn
}
