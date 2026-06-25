import "dotenv/config";
import express from "express";
import { runAgent } from "./agent.js";
import { KPIS, ALERTS, ORG } from "./data.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8787;

// Lightweight context the UI loads on boot (no LLM call).
app.get("/api/overview", (_req, res) => {
  res.json({ org: ORG, kpis: KPIS, alerts: ALERTS, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

// Streaming chat endpoint (Server-Sent Events).
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] required" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server. Copy .env.example to .env and add your key." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    await runAgent(messages, send);
    send({ type: "done" });
  } catch (err) {
    console.error("[agent error]", err);
    send({ type: "error", message: String(err?.message || err) });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n  Cadence backend on http://localhost:${PORT}`);
  console.log(`  Claude key: ${process.env.ANTHROPIC_API_KEY ? "loaded ✓" : "MISSING ✗  (add ANTHROPIC_API_KEY to .env)"}\n`);
});
