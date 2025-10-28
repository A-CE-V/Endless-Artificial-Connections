import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.NANO_BANANA_API_KEY,
});


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
 * Summarization endpoint (Hugging Face)
 */
app.post("/summarize", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing 'text' in request body" });

  try {
    // Use the Mistral model hosted on Hugging Face
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1",
      {
        inputs: `Summarize this text in a clear and concise way:\n\n${text}`,
        parameters: { max_new_tokens: 200, temperature: 0.3 },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extract model response
    const summary =
      response.data[0]?.generated_text?.trim() || "No summary generated";

    res.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to summarize text" });
  }
});

/**
 * NEW: Nano Banana (Gemini 2.5 Flash Image) endpoint
 * Generates an image from a text prompt.
 */

// POST /generate
app.post("/generate", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const imageData = part.inlineData.data;
        const imageBuffer = Buffer.from(imageData, "base64");

        // Option 1 — send directly as image
        res.setHeader("Content-Type", "image/png");
        return res.send(imageBuffer);

        // Option 2 — return base64 JSON instead
        // return res.json({ image: imageData });
      }
    }

    res.status(500).json({ error: "No image data in response" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



/**
 * Health endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
