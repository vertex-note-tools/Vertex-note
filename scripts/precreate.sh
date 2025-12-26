#!/usr/bin/env bash
set -euo pipefail

# Cloud Run Button builds/pushes to Artifact Registry like:
#   ${GOOGLE_CLOUD_REGION}-docker.pkg.dev/${GOOGLE_CLOUD_PROJECT}/cloud-run-source-deploy/${K_SERVICE}
REG_HOST="${GOOGLE_CLOUD_REGION}-docker.pkg.dev"

echo "Configuring Docker authentication for Artifact Registry: ${REG_HOST}"

# Writes docker credential helper config so docker push can auth cleanly.
gcloud auth configure-docker "${REG_HOST}" --quiet

# Extra safety: token-based login (non-fatal if it fails).
TOKEN="$(gcloud auth print-access-token || true)"
if [[ -n "${TOKEN}" ]]; then
  echo "${TOKEN}" | docker login -u oauth2accesstoken --password-stdin "https://${REG_HOST}" >/dev/null 2>&1 || true
fi
