import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "https://endless-forge-web.web.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const SUMMARIZATION_MODELS = [
  "Falconsai/medical_summarization",
  "facebook/bart-large-cnn",
  "sshleifer/distilbart-cnn-12-6",
  "google/pegasus-xsum",
];

const IMAGE_MODELS = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "black-forest-labs/FLUX.1-dev",
  "stabilityai/stable-diffusion-2-1",
  "stabilityai/stable-diffusion-3-medium-diffusers",
  "crynux-network/stable-diffusion-v1-5",
  "Qwen/Qwen-Image"
];

app.post("/summarize", async (req, res) => {
  const { text, modelIndex = 0 } = req.body;

  if (!text)
    return res.status(400).json({ error: "Missing 'text' in request body" });

  const selectedModel = SUMMARIZATION_MODELS[modelIndex];
  if (!selectedModel) {
    return res
      .status(400)
      .json({ error: `Invalid model index '${modelIndex}'.` });
  }

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${selectedModel}`,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let summary;
    if (response.data[0]?.summary_text) {
      summary = response.data[0].summary_text;
    } else if (response.data[0]?.generated_text) {
      summary = response.data[0].generated_text;
    } else {
      summary = JSON.stringify(response.data);
    }

    res.json({
      model: selectedModel,
      summary,
    });
  } catch (error) {
    console.error("Summarization error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to summarize text",
      details: error.response?.data || error.message,
    });
  }
});

app.post("/detect-ai", async (req, res) => {
  const { text } = req.body;
  if (!text)
    return res.status(400).json({ error: "Missing 'text' in request body" });

  const model = "openai-community/roberta-base-openai-detector";

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const scores = response.data[0];
    let aiScore = 0;
    let verdict = "Unknown";

    if (Array.isArray(scores)) {
      const fakeEntry = scores.find(
        (e) => e.label.toLowerCase() === "fake" || e.label.toLowerCase() === "ai"
      );
      if (fakeEntry) {
        aiScore = fakeEntry.score;
        verdict =
          aiScore > 0.5 ? "Likely AI-generated" : "Likely human-written";
      }
    }

    res.json({
      model_used: model,
      confidence: Math.round(aiScore * 100),
      verdict: verdict,
    });
  } catch (error) {
    console.error("AI detection error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to detect AI content",
      details: error.response?.data || error.message,
    });
  }
});

app.post("/generate", async (req, res) => {
  const { prompt, modelIndex = 0 } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const selectedModel = IMAGE_MODELS[modelIndex];
  if (!selectedModel) {
    return res.status(400).json({ error: `Invalid model index '${modelIndex}'.` });
  }

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${selectedModel}`,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          Accept: "image/png",
        },
        responseType: "arraybuffer", 
      }
    );

    const contentType = response.headers["content-type"];

    if (contentType && contentType.includes("application/json")) {
      const json = JSON.parse(Buffer.from(response.data).toString("utf8"));
      console.error("Image generation error:", json.error);
      return res.status(500).json({ error: json.error || "Unknown error" });
    }

    res.setHeader("Content-Type", contentType || "image/png");
    res.setHeader("Cache-Control", "no-cache");
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    res.end(response.data, "binary");
  } catch (error) {
    console.error("Image generation error:", error.message);
    res.status(500).json({ error: "Failed to generate image" });
  }
});


app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));