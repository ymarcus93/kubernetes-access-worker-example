locals {
  environment_map = {
    "dev" = "Development"
  }
  do_project_environment = local.environment_map[var.environment]
}


resource "digitalocean_kubernetes_cluster" "cluster" {
  name    = "${var.project_name}-${var.environment}"
  region  = var.region
  version = var.cluster_version

  tags = var.labels

  node_pool {
    name       = "${var.project_name}-${var.environment}-pool"
    size       = var.node_pool_size
    node_count = var.node_pool_count
    auto_scale = var.node_pool_auto_scale
    min_nodes  = var.node_pool_auto_scale ? var.node_pool_min_nodes : null
    max_nodes  = var.node_pool_auto_scale ? var.node_pool_max_nodes : null

    labels = {
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  maintenance_policy {
    start_time = "04:00"
    day        = "sunday"
  }

  auto_upgrade  = true
  surge_upgrade = true
  ha            = false
}

resource "digitalocean_project" "kubernetes_project" {
  name        = "${var.project_name}-${var.environment}"
  description = "DigitalOcean project for CF Kube Access App"
  purpose     = "Kubernetes"
  environment = local.do_project_environment

  resources = [
    digitalocean_kubernetes_cluster.cluster.urn
  ]
}
