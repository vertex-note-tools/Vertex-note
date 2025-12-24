// index.js
// Cloud Run inline function: Notes via Vertex AI
// Supports:
//   - Gemini 3 Pro        (publisher "google")
//   - Gemini 2.5 Pro      (publisher "google", modelVariant = "g25")
//   - Claude 4.5 Sonnet   (publisher "anthropic")
//   - Claude 4.5 Haiku    (publisher "anthropic", modelVariant = "haiku")

const functions = require("@google-cloud/functions-framework");
const { GoogleAuth } = require("google-auth-library");

// --- Helper: generic Vertex AI generateContent for any publisher/model ---
async function callVertexModel({
  projectId,
  location,
  publisher,
  modelId,
  prompt,
  generationConfig,
}) {
  const auth = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });
  const client = await auth.getClient();

  let url;
  let body;

  if (publisher === "anthropic") {
    // Anthropic Claude on Vertex AI uses the rawPredict/messages API, not generateContent.
    url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${modelId}:rawPredict`;

    body = {
      anthropic_version: "vertex-2023-10-16",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      // Default max_tokens; adjust if you want longer responses.
      max_tokens:
        (generationConfig && generationConfig.max_tokens) || 1024,
      stream: false,
    };
  } else {
    // Google (Gemini) models use the generateContent API.
    url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${modelId}:generateContent`;

    body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    };

    // Optional extra config (e.g. Gemini thinkingConfig)
    if (generationConfig) {
      body.generationConfig = generationConfig;
    }
  }

  const response = await client.request({
    url,
    method: "POST",
    data: body,
  });

  if (publisher === "anthropic") {
    const content = response.data.content || [];
    const text = content
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    return text.trim();
  } else {
    const candidates = response.data.candidates || [];
    if (!candidates.length) return "";

    const parts = candidates[0].content?.parts || [];
    const text = parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");

    return text.trim();
  }
}

// --- HTTP function: this name must match "Function entry point" ---
// URL is just your service root: https://...run.app
//
// Request body:
//   transcription : string (required)
//   customPrompt  : string (optional)
//   provider      : "gemini" | "claude" (optional, defaults to "gemini")
//   modelVariant  :
//        - when provider === "gemini": "g25" | "gemini2.5" | "gemini-2.5-pro" | "2.5"
//        - when provider === "claude": "sonnet" | "haiku"
functions.http("geminiVertexNote", async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, X-Proxy-Secret"
  );
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const projectId =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  // Gemini config
  const geminiLocation =
    process.env.GEMINI_LOCATION ||
    process.env.VERTEX_LOCATION ||
    "europe-west4";
  const geminiModelId =
    process.env.GEMINI_MODEL_ID || "gemini-3-pro";

  // Gemini 2.5 Pro (EU, europe-west1) – optional override
  const gemini25Location =
    process.env.GEMINI25_LOCATION || "europe-west1";
  const gemini25ModelId =
    process.env.GEMINI25_MODEL_ID || "gemini-2.5-pro";

  // Claude config
  const claudeLocation =
    process.env.CLAUDE_LOCATION || "europe-west1";
  const claudePublisher =
    process.env.CLAUDE_PUBLISHER || "anthropic";
  const claudeModelSonnet =
    process.env.CLAUDE_MODEL_ID_SONNET ||
    process.env.CLAUDE_MODEL_ID ||
    "claude-sonnet-4-5";
  const claudeModelHaiku =
    process.env.CLAUDE_MODEL_ID_HAIKU || "claude-haiku-4-5";
  const backendSecret = process.env.BACKEND_SECRET || "";

  if (!projectId) {
    return res.status(500).json({ error: "GCP_PROJECT_ID is not configured." });
  }

  // Shared-secret protection using X-Proxy-Secret header
  if (backendSecret) {
    const headerSecret = req.header("X-Proxy-Secret");
    if (headerSecret !== backendSecret) {
      return res
        .status(403)
        .json({ error: "Forbidden: bad or missing X-Proxy-Secret." });
    }
  }

  try {
    const body = req.body || {};
    const transcription = body.transcription;
    const customPrompt = body.customPrompt || "";
    const providerRaw = body.provider;
    const modelVariantRaw = body.modelVariant;

    if (!transcription || typeof transcription !== "string") {
      return res
        .status(400)
        .json({ error: "Missing 'transcription' (string) in request body." });
    }

    // Default provider is "gemini" so old frontends keep working.
    const provider =
      typeof providerRaw === "string"
        ? providerRaw.toLowerCase()
        : "gemini";

    const modelVariant =
      typeof modelVariantRaw === "string"
        ? modelVariantRaw.toLowerCase()
        : "sonnet";

    const extraPrompt =
      typeof customPrompt === "string" ? customPrompt.trim() : "";

    // Match your existing formatting rules
    const baseInstruction = `
Do not use bold text. Do not use asterisks (*) or Markdown formatting anywhere in the output.
All headings should be plain text with a colon.
`.trim();

    const finalPromptText =
      (extraPrompt ? extraPrompt + "\n\n" : "") +
      baseInstruction +
      "\n\nTRANSCRIPTION:\n" +
      transcription;

    let noteText = "";
    let usedModelId = "";
    let usedProvider = "";

    if (provider === "gemini") {
      usedProvider = "gemini";

      // Default: Gemini 3 Pro in geminiLocation
      let selectedLocation = geminiLocation;
      let selectedModelId = geminiModelId;

      // If caller explicitly wants Gemini 2.5 Pro, switch to that.
      if (
        modelVariant === "g25" ||
        modelVariant === "gemini2.5" ||
        modelVariant === "gemini-2.5-pro" ||
        modelVariant === "2.5"
      ) {
        selectedLocation = gemini25Location;
        selectedModelId = gemini25ModelId;
      }

      usedModelId = selectedModelId;

      // Only some Gemini models support thinkingConfig.
      // Keep it for the default gemini-3-pro, but REMOVE it for gemini-2.5-pro.
      let generationConfig = undefined;
      if (selectedModelId === geminiModelId) {
        generationConfig = {
          thinkingConfig: {
            thinkingLevel: "low",
          },
        };
      }


      noteText = await callVertexModel({
        projectId,
        location: selectedLocation,
        publisher: "google",
        modelId: selectedModelId,
        prompt: finalPromptText,
                generationConfig,
      });
    } else if (provider === "claude") {
      usedProvider = "claude";
      const modelId =
        modelVariant === "haiku" ? claudeModelHaiku : claudeModelSonnet;
      usedModelId = modelId;

      noteText = await callVertexModel({
        projectId,
        location: claudeLocation,
        publisher: claudePublisher,
        modelId,
        prompt: finalPromptText,
      });
    } else {
      return res.status(400).json({
        error: `Unknown provider '${providerRaw}'. Use 'gemini' or 'claude'.`,
      });
    }

    return res.json({
      note: noteText,
      provider: usedProvider,
      modelId: usedModelId,
    });
  } catch (err) {
    console.error("Error in geminiVertexNote:", err?.response?.data || err);
    return res.status(500).json({
      error: "Internal error calling Vertex backend.",
      details: err?.response?.data || String(err),
    });
  }
});
