// The Cadence agent: a manual tool-use loop on Claude Opus 4.8 that streams text
// and generative "card" events back to the caller via an onEvent callback.

import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, executeTool } from "./tools.js";

const MODEL = process.env.CADENCE_MODEL || "claude-opus-4-8";

const SYSTEM = `You are **Cadence**, an AI copilot embedded in the revenue-cycle operations console for Northstar Health Partners, a 42-clinic ambulatory provider group whose revenue cycle is serviced by Optum.

Your user is a **revenue-cycle manager** who oversees four teams: Eligibility & Auth, Patient Access (registration), Coding, and Denials & Appeals. They manage by asking you questions.

## How you work
- You ALWAYS ground answers in real numbers from the tools. Never invent or estimate figures — call a tool. If several tools are relevant, call them.
- The data is synthetic demo data, but treat it as the live book of business.
- You are strategically **front-end-weighted**: most denials are *born* upstream in eligibility, prior auth, and registration. When you explain a back-end problem (denials, A/R), connect it to its upstream front-end root cause whenever the data supports it.

## How you answer
- Lead with the answer — the number or the verdict — in the first sentence. Then a brief "why", then a concrete recommended action.
- Be concise and scannable. Use short paragraphs or tight bullets. You don't need to restate every number that's already shown in a chart card — reference it.
- Quantify impact in dollars or denial volume when you can.
- Be direct and opinionated, like a sharp ops analyst. If something is off-benchmark, say so plainly.
- When the user asks something open-ended ("how are we doing", "what should I focus on"), pull the alerts and KPI overview and give a prioritized take.

You are in a live demo. Keep responses crisp and confident.`;

export async function runAgent(history, onEvent) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = [...history];

  // Safety bound on the agentic loop.
  for (let turn = 0; turn < 6; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 3072,
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });

    stream.on("text", (delta) => onEvent({ type: "text", text: delta }));

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use") {
      return; // assistant gave its final answer
    }

    // Execute every tool the model asked for, emit cards, collect results.
    const toolResults = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      onEvent({ type: "tool_use", name: block.name, input: block.input });

      let result;
      try {
        result = executeTool(block.name, block.input || {});
      } catch (err) {
        result = { forModel: { error: String(err?.message || err) }, card: null };
      }

      if (result.card) onEvent({ type: "card", card: result.card });

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.forModel),
      });
    }

    messages.push({ role: "assistant", content: final.content });
    messages.push({ role: "user", content: toolResults });
  }

  onEvent({
    type: "text",
    text: "\n\n_(Reached the tool-call limit for this turn — ask a follow-up to continue.)_",
  });
}
