# Gemini Vertex Backend (Cloud Run proxy)

This repo deploys a Cloud Run service that your frontend calls with:
- Header: `X-Proxy-Secret: <BACKEND_SECRET>`
- POST JSON: `{ transcription, customPrompt, provider:"gemini", modelVariant:"g25" }`
- Response: `{ note: "..." }`

## Deploy (recommended)

> Prereqs: create a Google Cloud project and enable billing.

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run?git_repo=https://github.com/vertex-note-tools/Vertex-note&revision=main)

### During deploy
1. Select your **project**
2. Select region: **europe-west4** (required)

### After deploy
In the deploy logs you will see:
- `SERVICE_URL=...`
- `BACKEND_SECRET=...`

Paste into your frontend:
- `vertex_backend_url` = `SERVICE_URL`
- `vertex_backend_secret` = `BACKEND_SECRET`

### What the deploy does for you
- Enables required APIs (Cloud Run + Vertex AI)
- Creates a dedicated runtime service account (`vertex-gemini-backend`) and grants `roles/aiplatform.user`
- Sets `GCP_PROJECT_ID` on the service so the proxy can authenticate to Vertex AI
