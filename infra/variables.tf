variable "project_id" {
  type        = string
  description = "GCP project ID to deploy into (billing must already be enabled)."
}

variable "region" {
  type        = string
  description = "Cloud Run region."
  default     = "europe-west4"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "gemini-vertex-backend"
}

variable "container_image" {
  type        = string
  description = "Public container image reference for the backend."
  # TODO: change this to your published public image (Docker Hub or public Artifact Registry).
  default     = "docker.io/REPLACE_ME/gemini-vertex-backend:1.0.0"
}

variable "gemini25_model_id" {
  type        = string
  default     = "gemini-2.5-pro"
}

variable "gemini25_location" {
  type        = string
  default     = "europe-west1"
}

variable "gemini_model_id" {
  type        = string
  default     = "gemini-3-pro"
}

variable "gemini_location" {
  type        = string
  default     = "europe-west4"
}

variable "vertex_location" {
  type        = string
  default     = "europe-west4"
}
