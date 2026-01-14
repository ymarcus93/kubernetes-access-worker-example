provider "digitalocean" {
  token = var.do_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "random" {}

data "digitalocean_kubernetes_cluster" "cluster" {
  name = "${var.project_name}-${var.environment}"
  # Wait for cluster to be created
  depends_on = [module.digitalocean]
}

provider "kubernetes" {
  host                   = data.digitalocean_kubernetes_cluster.cluster.endpoint
  token                  = data.digitalocean_kubernetes_cluster.cluster.kube_config[0].token
  cluster_ca_certificate = base64decode(data.digitalocean_kubernetes_cluster.cluster.kube_config[0].cluster_ca_certificate)
}
