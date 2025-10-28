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
app.post("/generate-image", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Missing 'query' in request body" });

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateImage?key=${process.env.NANO_BANANA_API_KEY}`,
      {
        prompt: {
          text: query
        }
      }
    );

    res.json({ data: response.data });
  } catch (error) {
    console.error("Image generation error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || "Failed to generate image" });
  }
});



/**
 * Health endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
