import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS
app.use(
  cors({
    origin: "https://endless-forge-web.web.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/**
 * 📄 Summarization Endpoint
 * Uses Hugging Face BART summarizer (stable and free)
 */
const SUMMARIZATION_MODELS = [
  "facebook/bart-large-cnn",           // index 0
  "mistralai/Mixtral-8x7B-v0.1"        // index 1
];

const DETECTOR_MODEL = "Hello-SimpleAI/chatgpt-detector-roberta"; // reliable HF model


app.post("/summarize", async (req, res) => {
  const { text, modelIndex = 0 } = req.body; // default to 0 if not provided

  if (!text) return res.status(400).json({ error: "Missing 'text' in request body" });

  const selectedModel = SUMMARIZATION_MODELS[modelIndex];
  if (!selectedModel) {
    return res.status(400).json({ error: `Invalid model index '${modelIndex}'.` });
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

    // For Mixtral or other models, the output structure might differ.
    // We'll try to handle both the summarization case and a generic text output case.
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

/**
 *  AI DETECTION ENDPOINT
 */

app.post("/detect-ai", async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Missing 'text' in request body" });

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${DETECTOR_MODEL}`,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // HF models often return something like:
    // [{ "label": "AI", "score": 0.87 }, { "label": "Human", "score": 0.13 }]
    const output = response.data[0];
    let aiScore = 0;

    if (Array.isArray(output)) {
      const aiEntry = output.find((e) => e.label.toLowerCase().includes("ai"));
      aiScore = aiEntry ? aiEntry.score : 0;
    } else if (output?.label && output?.score !== undefined) {
      aiScore = output.label.toLowerCase().includes("ai") ? output.score : 1 - output.score;
    }

    res.json({
      model: DETECTOR_MODEL,
      confidence: Math.round(aiScore * 100),
      verdict: aiScore > 0.5 ? "Likely AI-generated" : "Likely human-written",
    });
  } catch (error) {
    console.error("AI detection error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to detect AI content",
      details: error.response?.data || error.message,
    });
  }
});


/**
 * 🍌 Nano Banana (now Hugging Face FLUX.1) Endpoint
 * Generates an image from a text prompt.
 */
app.post("/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          Accept: "image/png", // 👈 Required for image output
        },
        responseType: "arraybuffer", // 👈 Receive raw binary data
        validateStatus: () => true,
      }
    );

    const contentType = response.headers["content-type"];

    // If the response is JSON instead of PNG, show the error message
    if (contentType && contentType.includes("application/json")) {
      const json = JSON.parse(Buffer.from(response.data).toString("utf8"));
      console.error("Image generation error:", json.error);

      // Handle model warming up (common in Render/HuggingFace free tier)
      if (json.error?.includes("loading")) {
        return res.status(503).json({
          status: "loading",
          message:
            "Model is starting on Hugging Face — please retry in 30–60 seconds.",
        });
      }

      return res.status(500).json({ error: json.error || "Unknown error" });
    }

    // Success — send PNG image
    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("Image generation error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate image" });
  }
});


/**
 * 🩺 Health Check
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
