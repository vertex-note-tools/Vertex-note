# Gemini Vertex Backend (Cloud Run proxy)

This deploys a Cloud Run service that your frontend calls with:
- Header: `X-Proxy-Secret: <BACKEND_SECRET>`
- POST JSON: `{ transcription, customPrompt, provider:"gemini", modelVariant:"g25" }`
- Response: `{ note: "..." }`

## Deploy (EU default: europe-west4)

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/vertex-note-tools/Vertex-note.git&cloudshell_git_branch=main&cloudshell_tutorial=tutorial.md&cloudshell_workspace=.&show=terminal&ephemeral=true)

### What you’ll get
- `SERVICE_URL` (Cloud Run URL)
- `BACKEND_SECRET` (your personal secret; paste into the frontend as `X-Proxy-Secret`)



## After deploy
Copy:
- SERVICE_URL  -> paste into your app as `vertex_backend_url`
- BACKEND_SECRET -> paste into your app as `vertex_backend_secret`

## Permissions / APIs
The Cloud Run service account must be allowed to call Generative AI on Vertex.
Grant `roles/aiplatform.user` to the service account if needed. (See Vertex AI access control docs.)
