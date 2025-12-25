*** File: tutorial.md
## Deploy Gemini Vertex backend (EU default: europe-west4)

### Before you start
1) Create a Google Cloud project
2) Enable Billing for that project
3) In Cloud Shell, select the correct project in the project picker (top bar)

### Deploy
Run:

```bash
cd Vertex-note
chmod +x deploy.sh
./deploy.sh
```

When it finishes, it prints:
- SERVICE_URL
- BACKEND_SECRET

Paste into your frontend:
- vertex_backend_url = SERVICE_URL
- vertex_backend_secret = BACKEND_SECRET
