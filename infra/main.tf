provider "google" {
  project = var.project_id
  region  = "europe-west4"
}

locals {
  # Fixed deployment settings (do not expose as user inputs)
  region       = "europe-west4"
  service_name = "gemini-vertex-backend"

  # Fixed public image (Artifact Registry, Cloud Run compatible)
  # Update this tag when you publish a new backend image.
  container_image = "europe-west4-docker.pkg.dev/vertex-note-maintainer/public-images/gemini-vertex-backend:v1.0.1"

  # Gemini 2.5 Pro (primary)
  gemini25_model_id = "gemini-2.5-pro"
  gemini25_location = "europe-west1"

  # Optional fallback (keep if your backend reads these)
  gemini_model_id = "gemini-3-pro"
  gemini_location = "europe-west4"
  vertex_location = "europe-west4"
}


# Enable required APIs
resource "google_project_service" "run" {
  project            = var.project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "aiplatform" {
  project            = var.project_id
  service            = "aiplatform.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Runtime service account
resource "google_service_account" "runtime" {
  account_id   = "vertex-gemini-backend"
  display_name = "Vertex Note Backend Runtime"
}

# Allow calling Vertex AI
resource "google_project_iam_member" "aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
  # Avoid race: IAM binding before API is fully enabled
  depends_on = [google_project_service.aiplatform]
}

# Generate a per-deployment secret
resource "random_password" "backend_secret" {
  length  = 32
  # Copy/paste friendly for users (header + sessionStorage)
  special = false
}

resource "google_secret_manager_secret" "backend_secret" {
  secret_id = "vertex-backend-secret"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "backend_secret_v1" {
  secret      = google_secret_manager_secret.backend_secret.id
  secret_data = random_password.backend_secret.result
}

resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  secret_id = google_secret_manager_secret.backend_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# Cloud Run service (v2)
resource "google_cloud_run_v2_service" "svc" {
  name     = local.service_name
  location = local.region
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

    containers {
      image = local.container_image

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GEMINI25_MODEL_ID"
        value = local.gemini25_model_id
      }
      env {
        name  = "GEMINI25_LOCATION"
        value = local.gemini25_location
      }

      env {
        name  = "GEMINI_MODEL_ID"
        value = local.gemini_model_id
      }
      env {
        name  = "GEMINI_LOCATION"
        value = local.gemini_location
      }
      env {
        name  = "VERTEX_LOCATION"
        value = local.vertex_location
      }

      # BACKEND_SECRET from Secret Manager
      env {
        name = "BACKEND_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.backend_secret.secret_id
            version = google_secret_manager_secret_version.backend_secret_v1.version
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_project_service.aiplatform,
    google_project_service.secretmanager,
    google_secret_manager_secret_iam_member.runtime_secret_access,
    google_project_iam_member.aiplatform_user
  ]
}

# Public invoker (matches your current approach)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = google_cloud_run_v2_service.svc.name
  location = google_cloud_run_v2_service.svc.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
