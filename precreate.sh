*** File: scripts/precreate.sh
#!/usr/bin/env bash
set -euo pipefail

echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  --quiet

# Cloud Run Button cannot preselect a default region in app.json.
# We fail-fast if the user picked the wrong region.
if [[ "${GOOGLE_CLOUD_REGION:-}" != "europe-west4" ]]; then
  echo ""
  echo "❌ Wrong region selected: ${GOOGLE_CLOUD_REGION:-<empty>}"
  echo "Please re-run deploy and select region: europe-west4"
  exit 1
fi
