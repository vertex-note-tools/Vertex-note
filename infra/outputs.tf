output "service_url" {
  value       = google_cloud_run_v2_service.svc.uri
  description = "Paste into your frontend as vertex_backend_url."
}

output "backend_secret" {
  value       = random_password.backend_secret.result
  description = "Paste into your frontend as vertex_backend_secret."
  sensitive   = true
}

output "region" {
  description = "Cloud Run region."
  value       = google_cloud_run_v2_service.svc.location
}
