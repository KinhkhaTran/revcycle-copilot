# Cadence — Rev Cycle Copilot

An AI copilot for a **healthcare revenue-cycle manager** at an Optum/UHG-serviced
provider group. You manage your revenue cycle *by asking questions* — Cadence pulls
live numbers across eligibility, prior auth, registration, coding, and denials, then
tells you what's working, what's bleeding money, and what to do about it.

It runs a real **Claude Opus 4.8 agent** that calls tools over a synthetic
revenue-cycle dataset and answers with **generative chart/stat cards** plus a crisp
written take.

> Built as a standalone prototype for the UHC.AI / Optum internship. Synthetic data
> only — no PHI.

---

## The concept

- **User:** an RCM manager overseeing four teams (Eligibility & Auth, Patient Access,
  Coding, Denials & Appeals).
- **The agent does two things at once:** answers **productivity** questions ("how is
  my team doing", "who's behind") *and* does **denial root-cause + action** ("why are
  denials up, and where do they start").
- **Front-end-weighted (the strategic story):** ~55% of denials are *born* upstream in
  eligibility / prior auth / registration. Cadence is biased to trace back-end pain to
  its front-end cause and tell you to "fix it upstream." That's the pitch:
  **stop denials before they happen.**

This is deliberately complementary to **Optum Real** (the real-time claims engine):
Cadence is the *internal-facing insights & action layer* a manager talks to, not a
claims-adjudication predictor.

---

## Architecture

```
┌─────────────────────────┐        SSE (text + cards)        ┌──────────────────────────┐
│  React + Vite + Tailwind │  ◀───────────────────────────   │  Node / Express backend  │
│  (chat + generative UI)  │   POST /api/chat  ───────────▶   │  holds ANTHROPIC_API_KEY │
└─────────────────────────┘                                  │  runs the agent loop     │
                                                              └────────────┬─────────────┘
                                                                           │ tool calls
                                                              ┌────────────▼─────────────┐
                                                              │  Claude Opus 4.8         │
                                                              │  + 10 rev-cycle tools    │
                                                              │  over synthetic data     │
                                                              └──────────────────────────┘
```

**The Claude API key never reaches the browser.** The backend holds it, runs the
tool-use loop, and streams text deltas + chart "card" specs over Server-Sent Events.

Key files:

| File | What it is |
|---|---|
| `server/data.js` | The synthetic dataset (front-end-weighted, tuned to 2026 benchmarks) |
| `server/tools.js` | 10 tool schemas + executors; each returns model data **and** a viz card |
| `server/agent.js` | The Opus 4.8 manual tool-use loop, streaming over a callback |
| `server/index.js` | Express server: `/api/overview` (boot data) + `/api/chat` (SSE) |
| `src/App.tsx` | KPI rail, alerts, chat thread, suggested prompts |
| `src/components/CardView.tsx` | Renders stat / bar / line / donut / table / alert cards (Recharts) |

---

## Run it

```bash
# 1. install
npm install

# 2. add your key
cp .env.example .env
#   then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. start backend + frontend together
npm run dev
```

Open **http://localhost:5173**. (Backend runs on :8787; Vite proxies `/api` to it.)

Without a key the UI still loads (KPI rail, alerts, charts), but the agent will return
a "key missing" message — handy for showing the shell before wiring the key.

---

## Demo script (front-end-weighted questions land best)

1. **"What should I focus on to recover the most revenue?"** → pulls alerts + KPIs,
   prioritizes the eligibility-driven denial leak.
2. **"Why are our denials up, and where do they start?"** → denial donut by root cause,
   traces 55% back to the front-end.
3. **"How is my team doing this week?"** → productivity table, flags who's behind.
4. **"Which payer should I worry about for prior auth?"** → PA-by-payer bar (Cigna lags).
5. **"Show me the eligibility auto-verify trend."** → 13-week line chart.

---

## How to extend

- **More data / realism:** edit `server/data.js`. Add fields and they flow straight
  through the matching tool.
- **New capability:** add a tool to `TOOLS` in `server/tools.js` with a schema + an
  `executeTool` case returning `{ forModel, card }`. The agent discovers it
  automatically; the UI renders the card if it's a known type.
- **New chart type:** add a `case` to `CardView.tsx` and a matching `card.type`.
- **Swap to real data later:** the tool executors are the only thing that touches data —
  point them at real APIs (e.g. an Optum Real / analytics endpoint) and the rest is
  unchanged. This is the "here's how it scales" slide.

---

## Notes for the pitch

- **Agentic, not a chatbot:** it *acts* (pulls data, renders UI, recommends), and the
  tool loop is real — show the "Breaking down denials…" working indicator.
- **Outcome-owning framing:** every answer ends with a recommended action, in dollars.
- **Safe by construction:** synthetic data, key server-side only, "verify before acting"
  disclaimer in the footer.
