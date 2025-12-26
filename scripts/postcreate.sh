#!/usr/bin/env bash
set -euo pipefail

SA_NAME="vertex-gemini-backend"
SA_EMAIL="${SA_NAME}@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"

echo "Ensuring service account ${SA_EMAIL} exists..."
gcloud iam service-accounts describe "${SA_EMAIL}" --project "${GOOGLE_CLOUD_PROJECT}" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "${SA_NAME}" \
    --project "${GOOGLE_CLOUD_PROJECT}" \
    --display-name="Vertex Note Backend" \
    --quiet

echo "Granting roles/aiplatform.user to ${SA_EMAIL}..."
gcloud projects add-iam-policy-binding "${GOOGLE_CLOUD_PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user" \
  --quiet

echo "Updating Cloud Run service (service account + env vars)..."
gcloud run services update "${K_SERVICE}" \
  --region "${GOOGLE_CLOUD_REGION}" \
  --service-account "${SA_EMAIL}" \
  --set-env-vars "GCP_PROJECT_ID=${GOOGLE_CLOUD_PROJECT},GEMINI25_MODEL_ID=gemini-2.5-pro,GEMINI25_LOCATION=europe-west1,VERTEX_LOCATION=europe-west4,GEMINI_MODEL_ID=gemini-3-pro,GEMINI_LOCATION=europe-west4" \
  --quiet

echo ""
echo "✅ Deploy complete"
echo "SERVICE_URL=${SERVICE_URL}"
echo "BACKEND_SECRET=${BACKEND_SECRET}"
echo ""
echo "Paste into your frontend:"
echo "  vertex_backend_url    = SERVICE_URL"
echo "  vertex_backend_secret = BACKEND_SECRET"
