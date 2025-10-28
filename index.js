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
app.post("/summarize", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing 'text' in request body" });

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const summary = response.data[0]?.summary_text || "No summary generated";
    res.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to summarize text" });
  }
});

app.post("/summarize-alt", async (req, res) => {
  const { text } = req.body;
  if (!text)
    return res.status(400).json({ error: "Missing 'text' in request body" });

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-v0.1",
      {
        inputs: `Summarize the following text clearly and concisely:\n\n${text}`,
        parameters: { max_new_tokens: 300, temperature: 0.3 },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract generated summary text
    const summary =
      response.data?.[0]?.generated_text?.trim() ||
      response.data?.generated_text?.trim() ||
      "No summary generated";

    res.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to summarize text" });
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
