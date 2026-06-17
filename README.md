# Gemini Vertex Backend (Cloud Run proxy)

This repo deploys a Cloud Run service that your frontend calls with:
- Header: `X-Proxy-Secret: <BACKEND_SECRET>`
- POST JSON: `{ transcription, customPrompt, provider:"gemini", modelVariant:"g25" }`
- Response: `{ note, provider, modelId, usage }`

## Supported Gemini models (`modelVariant`)

| modelVariant | Model | Vertex model ID | Location |
|---|---|---|---|
| `g25` (or `gemini-2.5-pro`, `2.5`) | Gemini 2.5 Pro | `gemini-2.5-pro` | `europe-west1` (EU single-region) |
| `g35-flash` (or `flash`, `gemini-3.5-flash`, `3.5-flash`) | Gemini 3.5 Flash | `gemini-3.5-flash` | `eu` (EU multi-region) |
| `g31-flash-lite` (or `flash-lite`, `gemini-3.1-flash-lite`, `3.1-flash-lite`) | Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | `eu` (EU multi-region) |

All model IDs and locations are overridable via environment variables
(`GEMINI25_*`, `GEMINI35_FLASH_*`, `GEMINI31_FLASH_LITE_*`), so you can adjust
them without rebuilding the image.

EU data residency: 2.5 Pro is pinned to the `europe-west1` single region.
Gemini 3.x Flash / Flash-Lite are not offered as single-region EU endpoints yet,
so they use the EU multi-region endpoint (`eu`), which keeps ML processing within
the EU geography. Both Gemini 3.5 Flash and Gemini 3.1 Flash-Lite are GA. The older
`gemini-3.1-flash-lite-preview` is being discontinued (2026-07-09); this backend
uses the GA `gemini-3.1-flash-lite`.

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

## Upgrading an existing deployment

New deployments from `main` get the new models automatically. If you already
deployed an earlier version, re-apply your Infrastructure Manager / Terraform
deployment after the new image tag (`v1.0.4`) is published — this updates the
container image and adds the `GEMINI35_FLASH_*` and `GEMINI31_FLASH_LITE_*`
environment variables. No secret rotation or service-account change is required.
