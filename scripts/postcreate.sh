*** File: scripts/postcreate.sh

#!/usr/bin/env bash
set -euo pipefail

SA_NAME="vertex-gemini-backend"
SA_EMAIL="${SA_NAME}@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"

echo "Ensuring service account ${SA_EMAIL} exists..."
gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "${SA_NAME}" --display-name="Vertex Note Backend" --quiet

echo "Granting roles/aiplatform.user to ${SA_EMAIL}..."
gcloud projects add-iam-policy-binding "${GOOGLE_CLOUD_PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user" \
  --quiet

echo "Updating Cloud Run service to use ${SA_EMAIL} and setting GCP_PROJECT_ID..."
gcloud run services update "${K_SERVICE}" \
  --region "${GOOGLE_CLOUD_REGION}" \
  --service-account "${SA_EMAIL}" \
  --set-env-vars "GCP_PROJECT_ID=${GOOGLE_CLOUD_PROJECT}" \
  --quiet

FINAL_URL="$(gcloud run services describe "${K_SERVICE}" --region "${GOOGLE_CLOUD_REGION}" --format='value(status.url)')"

echo ""
echo "✅ DEPLOYED"
echo "SERVICE_URL=${FINAL_URL}"
echo "BACKEND_SECRET=${BACKEND_SECRET}"
echo ""
echo "Paste into your frontend:"
echo "  vertex_backend_url    = SERVICE_URL"
echo "  vertex_backend_secret = BACKEND_SECRET"
