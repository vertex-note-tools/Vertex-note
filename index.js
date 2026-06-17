// index.js
// Cloud Run inline function: Notes via Vertex AI
// Supports (publisher "google"):
//   - Gemini 3 Pro          (default, no/unknown modelVariant) -> gemini-3-pro
//   - Gemini 2.5 Pro        (modelVariant = "g25")             -> gemini-2.5-pro   @ europe-west1 (EU single-region)
//   - Gemini 3.5 Flash      (modelVariant = "g35-flash")       -> gemini-3.5-flash @ eu (EU multi-region)
//   - Gemini 3.1 Flash-Lite (modelVariant = "g31-flash-lite")  -> gemini-3.1-flash-lite @ eu (EU multi-region, GA)
// and Anthropic Claude (publisher "anthropic", provider = "claude").
//
// EU data residency: 2.5 Pro is pinned to the europe-west1 single region.
// Gemini 3.x Flash / Flash-Lite are not offered as single-region EU endpoints yet,
// so they use the EU multi-region endpoint ("eu" -> aiplatform.eu.rep.googleapis.com),
// which keeps ML processing within the EU geography.

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

  // Resolve the API host from the location. Vertex AI uses THREE host schemes:
  //   - Regional endpoint ("europe-west1"): "{location}-aiplatform.googleapis.com"
  //   - Multi-region endpoint ("eu", "us"): "aiplatform.{location}.rep.googleapis.com"
  //     NOT "eu-aiplatform.googleapis.com" (that host does not exist and 404s).
  //     The request path still uses "locations/eu" | "locations/us".
  //     These .rep. endpoints are the data-residency-guaranteed ones.
  //   - Global endpoint ("global"): "aiplatform.googleapis.com" (no residency guarantee;
  //     kept as a fallback if a model's EU availability ever changes).
  let apiHost;
  if (location === "global") {
    apiHost = "aiplatform.googleapis.com";
  } else if (location === "eu" || location === "us") {
    apiHost = `aiplatform.${location}.rep.googleapis.com`;
  } else {
    apiHost = `${location}-aiplatform.googleapis.com`;
  }

  let url;
  let body;

  if (publisher === "anthropic") {
    // Anthropic Claude on Vertex AI uses the rawPredict/messages API, not generateContent.
    url = `https://${apiHost}/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${modelId}:rawPredict`;

    body = {
      anthropic_version: "vertex-2023-10-16",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      // Default max_tokens; adjust if you want longer responses.
      max_tokens: (generationConfig && generationConfig.max_tokens) || 1024,
      stream: false,
    };
  } else {
    // Google (Gemini) models use the generateContent API.
    url = `https://${apiHost}/v1/projects/${projectId}/locations/${location}/publishers/${publisher}/models/${modelId}:generateContent`;

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

    // Claude on Vertex: usage is returned under `response.data.usage`
    const usageRaw = response.data.usage || {};
    const promptTokens =
      typeof usageRaw.input_tokens === "number" ? usageRaw.input_tokens : undefined;
    const outputTokens =
      typeof usageRaw.output_tokens === "number" ? usageRaw.output_tokens : undefined;
    const totalTokens =
      typeof promptTokens === "number" && typeof outputTokens === "number"
        ? promptTokens + outputTokens
        : undefined;

    return {
      text: text.trim(),
      usage: {
        promptTokens,
        outputTokens,
        totalTokens,
        raw: usageRaw,
      },
    };
  } else {
    const candidates = response.data.candidates || [];
    if (!candidates.length) return { text: "", usage: undefined };

    const parts = candidates[0].content?.parts || [];
    const text = parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("");

    // Gemini on Vertex: usage is returned under `response.data.usageMetadata`
    const usageRaw = response.data.usageMetadata || {};
    const promptTokens =
      typeof usageRaw.promptTokenCount === "number"
        ? usageRaw.promptTokenCount
        : undefined;
    const outputTokens =
      typeof usageRaw.candidatesTokenCount === "number"
        ? usageRaw.candidatesTokenCount
        : undefined;
    const totalTokens =
      typeof usageRaw.totalTokenCount === "number"
        ? usageRaw.totalTokenCount
        : undefined;

    

    return {
      text: text.trim(),
      usage: {
        promptTokens,
        outputTokens,
        totalTokens,
        raw: usageRaw,
      },
    };
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
//        - when provider === "gemini":
//             "g25" | "gemini2.5" | "gemini-2.5-pro" | "2.5"          -> Gemini 2.5 Pro
//             "g35-flash" | "flash" | "gemini-3.5-flash" | "3.5-flash" -> Gemini 3.5 Flash
//             "g31-flash-lite" | "flash-lite" | "gemini-3.1-flash-lite" | "3.1-flash-lite" -> Gemini 3.1 Flash-Lite
//             (anything else / omitted defaults to Gemini 3 Pro)
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

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  // Gemini config
  const geminiLocation =
    process.env.GEMINI_LOCATION || process.env.VERTEX_LOCATION || "europe-west4";
  const geminiModelId = process.env.GEMINI_MODEL_ID || "gemini-3-pro";

  // Gemini 2.5 Pro (EU single-region, europe-west1) – primary
  const gemini25Location = process.env.GEMINI25_LOCATION || "europe-west1";
  const gemini25ModelId = process.env.GEMINI25_MODEL_ID || "gemini-2.5-pro";

  // Gemini 3.5 Flash (GA) – EU multi-region "eu" (no single-region EU endpoint yet)
  const gemini35FlashLocation = process.env.GEMINI35_FLASH_LOCATION || "eu";
  const gemini35FlashModelId = process.env.GEMINI35_FLASH_MODEL_ID || "gemini-3.5-flash";

  // Gemini 3.1 Flash-Lite (GA) – EU multi-region "eu".
  // Use the GA model ID "gemini-3.1-flash-lite" (the older
  // "gemini-3.1-flash-lite-preview" is being discontinued 2026-07-09).
  // If "eu" is unavailable for it, set the location env var to "global" as a
  // fallback (note: global has no EU residency guarantee).
  const gemini31FlashLiteLocation = process.env.GEMINI31_FLASH_LITE_LOCATION || "eu";
  const gemini31FlashLiteModelId =
    process.env.GEMINI31_FLASH_LITE_MODEL_ID || "gemini-3.1-flash-lite";

  // Claude config
  const claudeLocation = process.env.CLAUDE_LOCATION || "europe-west1";
  const claudePublisher = process.env.CLAUDE_PUBLISHER || "anthropic";
  const claudeModelSonnet =
    process.env.CLAUDE_MODEL_ID_SONNET ||
    process.env.CLAUDE_MODEL_ID ||
    "claude-sonnet-4-5";
  const claudeModelHaiku = process.env.CLAUDE_MODEL_ID_HAIKU || "claude-haiku-4-5";
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
      typeof providerRaw === "string" ? providerRaw.toLowerCase() : "gemini";

    const modelVariant =
      typeof modelVariantRaw === "string" ? modelVariantRaw.toLowerCase() : "sonnet";

    const extraPrompt = typeof customPrompt === "string" ? customPrompt.trim() : "";

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
    let usage = undefined;

    if (provider === "gemini") {
      usedProvider = "gemini";

      // Normalize the variant key (lowercased above; also strip spaces).
      const v = modelVariant.replace(/\s+/g, "");

      // Default: Gemini 3 Pro in geminiLocation (unchanged legacy behavior).
      let selectedLocation = geminiLocation;
      let selectedModelId = geminiModelId;
      // Gemini 3.x supports thinkingConfig.thinkingLevel. Keep "low" for fast,
      // cost-controlled clinical note generation. (Omitted for 2.5 Pro below.)
      let generationConfig = { thinkingConfig: { thinkingLevel: "low" } };

      if (
        v === "g31-flash-lite" ||
        v === "flash-lite" ||
        v === "flashlite" ||
        v === "gemini-3.1-flash-lite" ||
        v === "3.1-flash-lite"
      ) {
        // Gemini 3.1 Flash-Lite (GA) on the EU multi-region.
        selectedLocation = gemini31FlashLiteLocation;
        selectedModelId = gemini31FlashLiteModelId;
        generationConfig = { thinkingConfig: { thinkingLevel: "low" } };
      } else if (
        v === "g35-flash" ||
        v === "flash" ||
        v === "gemini-3.5-flash" ||
        v === "3.5-flash"
      ) {
        // Gemini 3.5 Flash (GA) on the EU multi-region.
        selectedLocation = gemini35FlashLocation;
        selectedModelId = gemini35FlashModelId;
        generationConfig = { thinkingConfig: { thinkingLevel: "low" } };
      } else if (
        v === "g25" ||
        v === "gemini2.5" ||
        v === "gemini-2.5-pro" ||
        v === "2.5"
      ) {
        // Gemini 2.5 Pro on the EU single-region (europe-west1).
        selectedLocation = gemini25Location;
        selectedModelId = gemini25ModelId;
        // 2.5 Pro: do NOT send a Gemini 3.x-style thinkingConfig.
        generationConfig = undefined;
      }

      usedModelId = selectedModelId;

      const result = await callVertexModel({
        projectId,
        location: selectedLocation,
        publisher: "google",
        modelId: selectedModelId,
        prompt: finalPromptText,
        generationConfig,
      });
      noteText = result.text;
      usage = result.usage;
    } else if (provider === "claude") {
      usedProvider = "claude";
      const modelId = modelVariant === "haiku" ? claudeModelHaiku : claudeModelSonnet;
      usedModelId = modelId;

      const result = await callVertexModel({
        projectId,
        location: claudeLocation,
        publisher: claudePublisher,
        modelId,
        prompt: finalPromptText,
      });
      noteText = result.text;
      usage = result.usage;
    } else {
      return res.status(400).json({
        error: `Unknown provider '${providerRaw}'. Use 'gemini' or 'claude'.`,
      });
    }

    
    if (usage && (usage.promptTokens != null || usage.outputTokens != null)) {
      
      console.log(
        `[vertex tokens] provider=${usedProvider} model=${usedModelId} ` +
          `input=${usage.promptTokens ?? "?"} output=${usage.outputTokens ?? "?"} total=${usage.totalTokens ?? "?"}`
      );
    } else {
      console.log(
        `[vertex tokens] provider=${usedProvider} model=${usedModelId} (token usage missing in response)`
      );
    }

    return res.json({
      note: noteText,
      provider: usedProvider,
      modelId: usedModelId,
      usage,
    });
  } catch (err) {
    console.error("Error in geminiVertexNote:", err?.response?.data || err);
    return res.status(500).json({
      error: "Internal error calling Vertex backend.",
      details: err?.response?.data || String(err),
    });
  }
});
