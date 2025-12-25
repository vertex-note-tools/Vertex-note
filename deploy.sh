*** File: deploy.sh
#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-gemini-vertex-backend}"
REGION="${REGION:-europe-west4}"

echo "Using service: $SERVICE_NAME"
echo "Using region:  $REGION"

# Ensure a project is selected
PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
if [[ -z "$PROJECT_ID" ]]; then
  echo "No GCP project selected."
  echo "Select your project in the Cloud Shell picker or run:"
  echo "  gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi
echo "Using project: $PROJECT_ID"

# Avoid interactive prompts for region
gcloud config set run/region "$REGION" >/dev/null
gcloud config set compute/region "$REGION" >/dev/null || true

echo "Enabling required APIs (may take a minute on new projects)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com >/dev/null

# Secret: prompt user (or generate if they just press enter)
if [[ -z "${BACKEND_SECRET:-}" ]]; then
  read -r -s -p "Enter BACKEND_SECRET (press Enter to auto-generate): " BACKEND_SECRET
  echo
fi
if [[ -z "$BACKEND_SECRET" ]]; then
  # Auto-generate a reasonably strong secret
  BACKEND_SECRET="$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()-_=+.' </dev/urandom | head -c 32)"
  echo "Generated BACKEND_SECRET."
fi

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "VERTEX_LOCATION=europe-west4" \
  --set-env-vars "GEMINI_MODEL_ID=gemini-3-pro" \
  --set-env-vars "GEMINI_LOCATION=europe-west4" \
  --set-env-vars "GEMINI25_MODEL_ID=gemini-2.5-pro" \
  --set-env-vars "GEMINI25_LOCATION=europe-west1" \
  --set-env-vars "BACKEND_SECRET=$BACKEND_SECRET"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
echo
echo "✅ Done"
echo "SERVICE_URL=$SERVICE_URL"
echo "BACKEND_SECRET=$BACKEND_SECRET"
echo
echo "Paste into your frontend:"
echo "  vertex_backend_url    = SERVICE_URL"
echo "  vertex_backend_secret = BACKEND_SECRET"
