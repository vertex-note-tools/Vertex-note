# Gemini Vertex Backend (Cloud Run proxy)

This deploys a Cloud Run service that your frontend calls with:
- Header: `X-Proxy-Secret: <BACKEND_SECRET>`
- POST JSON: `{ transcription, customPrompt, provider:"gemini", modelVariant:"g25" }`
- Response: `{ note: "..." }`

## 1-click deploy

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run?git_repo=https://github.com/vertex-note-tools/Vertex-note&revision=main)


## After deploy
Copy:
- SERVICE_URL  -> paste into your app as `vertex_backend_url`
- BACKEND_SECRET -> paste into your app as `vertex_backend_secret`

## Permissions / APIs
The Cloud Run service account must be allowed to call Generative AI on Vertex.
Grant `roles/aiplatform.user` to the service account if needed. (See Vertex AI access control docs.)
