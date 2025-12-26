variable "project_id" {
  type        = string
  description = "GCP project id where the backend will be deployed (the user's project)."
}

variable "region" {
  type        = string
  description = "Cloud Run region for the backend service."
  default     = "europe-west4"
  validation {
    condition     = var.region == "europe-west4"
    error_message = "This backend must be deployed in europe-west4."
  }
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "gemini-vertex-backend"
}

variable "container_image" {
  type        = string
  description = <<EOT
Public container image reference to deploy to Cloud Run.
This must be publicly pullable (no auth) so random users can deploy in their own GCP projects.

Default points to a public Google Artifact Registry image (docker.pkg.dev).
Replace <MAINTAINER_PROJECT_ID> and <AR_REPO_NAME> with your maintainer project/repo.
EOT

  default = "europe-west4-docker.pkg.dev/vertex-note-maintainer/public-images/gemini-vertex-backend:v1.0.1"

  validation {
    condition = can(regex(
      "^europe-west4-docker\\.pkg\\.dev/vertex-note-maintainer/public-images/gemini-vertex-backend:(.+)$",
      var.container_image
    ))
    error_message = "container_image must be europe-west4-docker.pkg.dev/vertex-note-maintainer/public-images/gemini-vertex-backend:<tag>."
  }
}

# Gemini 2.5 Pro (primary)
variable "gemini25_model_id" {
  type        = string
  description = "Vertex AI model id for Gemini 2.5."
  default     = "gemini-2.5-pro"
}

variable "gemini25_location" {
  type        = string
  description = "Vertex AI location for Gemini 2.5."
  default     = "europe-west1"
  validation {
    condition     = contains(["europe-west1", "europe-west4"], var.gemini25_location)
    error_message = "gemini25_location must be an EU region (europe-west1 or europe-west4)."
  }
}

# Optional fallback (Gemini 3 / other)
variable "gemini_model_id" {
  type        = string
  description = "Fallback Vertex AI model id (optional)."
  default     = "gemini-3-pro"
}

variable "gemini_location" {
  type        = string
  description = "Fallback Vertex AI location (optional)."
  default     = "europe-west4"
}

# Used by your backend as VERTEX_LOCATION (if it needs a default region for Vertex-related calls)
variable "vertex_location" {
  type        = string
  description = "Default Vertex location used by the backend (if applicable)."
  default     = "europe-west4"
}
