const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "JobTracker API running" });
});

// ── EXTRACT RESUME ────────────────────────────────────────────
// POST /extract
// Body: { base64: "...", mediaType: "application/pdf" }
app.post("/extract", async (req, res) => {
  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: "No PDF data provided" });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are a resume parser. Extract data and return ONLY a JSON object with these exact keys. No markdown, no explanation, no extra text.
{
  "skills": "comma-separated list of all technical skills",
  "projects": "comma-separated list of project names only",
  "experience": "one line per role: Title @ Company (dates) — separated by | ",
  "bullets": ["every bullet point string from the entire resume verbatim"]
}
Be thorough. Extract every single bullet point verbatim.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            { type: "text", text: "Extract resume data as JSON." },
          ],
        },
      ],
    });

    const text = response.content?.find((c) => c.type === "text")?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({
      success: true,
      skills:     parsed.skills || "",
      projects:   parsed.projects || "",
      experience: parsed.experience || "",
      bullets:    Array.isArray(parsed.bullets)
        ? JSON.stringify(parsed.bullets)
        : parsed.bullets || "[]",
    });
  } catch (err) {
    console.error("Extract error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
