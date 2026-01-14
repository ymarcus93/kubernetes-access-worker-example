variable "project_name" {
  description = "Name of the DigitalOcean project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
}

variable "node_pool_size" {
  description = "Droplet size for node pool"
  type        = string
}

variable "node_pool_count" {
  description = "Number of nodes in the pool"
  type        = number
}

variable "node_pool_auto_scale" {
  description = "Enable auto-scaling"
  type        = bool
}

variable "node_pool_min_nodes" {
  description = "Minimum number of nodes"
  type        = number
}

variable "node_pool_max_nodes" {
  description = "Maximum number of nodes"
  type        = number
}

variable "enable_monitoring" {
  description = "Enable monitoring"
  type        = bool
}

variable "labels" {
  description = "Labels to apply to DO resources"
  type        = set(string)
  default     = []
}

