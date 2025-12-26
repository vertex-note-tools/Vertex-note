#!/usr/bin/env bash
set -euo pipefail

echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  iam.googleapis.com \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --quiet

# Cloud Run Button cannot auto-default region; enforce the correct one.
if [[ "${GOOGLE_CLOUD_REGION:-}" != "europe-west4" ]]; then
  echo ""
  echo "❌ Wrong region selected: ${GOOGLE_CLOUD_REGION:-<empty>}"
  echo "Please re-run deploy and select region: europe-west4"
  exit 1
fi
