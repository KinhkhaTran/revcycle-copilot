import { memo, useEffect, useMemo, useRef, useState } from "react";
import { streamChat, type Mode, type Segment } from "./api";
import CardView from "./components/CardView";
import CommandPalette, { type PaletteAction } from "./components/CommandPalette";
import DashboardView from "./components/DashboardView";
import Markdown from "./components/Markdown";
import type { ChatMessage, Kpi, Overview } from "./types";

// Sidebar navigation. "dashboard" is the Cycle-by-Stage flow rail; "ask" and
// "learn" are the two chat modes (pro / learn) surfaced as their own pages.
type Nav = "dashboard" | "ask" | "learn" | "guide";
const PAGE_LABEL: Record<Nav, string> = { dashboard: "Dashboard", ask: "Ask Cadence", learn: "Learn", guide: "Guide" };

// Seeds the morning briefing. Phrased to lean on get_alerts + get_kpi_overview
// and to render well through the markdown component (headline → list → lever).
const BRIEFING_PROMPT =
  "Good morning — give me my daily briefing. Pull the active alerts and the KPI overview first, then respond with exactly: a one-sentence headline on how the revenue cycle is doing today; then a `## Today's top 3 priorities` numbered list, each ranked by revenue impact with the dollar figure and its upstream root cause; then one closing sentence naming the single biggest lever to pull. Keep it tight and scannable — no preamble.";

const FRONT_BRIEFING =
  "Good morning — give me my front-end briefing (eligibility, prior authorization, patient registration). Pull the relevant alerts and front-end KPIs first, then respond with exactly: a one-sentence headline on how the front-end is doing today; then a `## Today's top 3 front-end priorities` numbered list, each ranked by revenue impact with the dollar figure and the downstream denials it prevents; then one closing sentence naming the single biggest lever. Keep it tight and scannable — no preamble.";

const BACK_BRIEFING =
  "Good morning — give me my back-end briefing (denials & appeals, accounts receivable, cash). Pull the relevant alerts and back-end KPIs first, then respond with exactly: a one-sentence headline on how the back-end is doing today; then a `## Today's top 3 back-end priorities` numbered list, each ranked by revenue impact with the dollar figure and, where it applies, the upstream front-end root cause; then one closing sentence naming the single biggest lever. Keep it tight and scannable — no preamble.";

// The segment selector shown on the Productivity tab.
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "All" },
  { key: "front", label: "Front-end" },
  { key: "back", label: "Back-end" },
];

// Per-segment featured briefing + starter chips for the Productivity tab.
const PRO_SEGMENTS: Record<Segment, { featured: { label: string; sub: string; prompt: string }; suggestions: string[] }> = {
  all: {
    featured: { label: "Get my morning briefing", sub: "Your top 3 priorities by revenue impact, triaged", prompt: BRIEFING_PROMPT },
    suggestions: [
      "What should I focus on to recover the most revenue?",
      "What would fixing eligibility auto-verify be worth?",
      "Which payer is my biggest problem right now?",
      "Which denied claims should we work first today?",
    ],
  },
  front: {
    featured: { label: "Get my front-end briefing", sub: "Eligibility, prior auth & registration — triaged", prompt: FRONT_BRIEFING },
    suggestions: [
      "How is eligibility verification performing?",
      "Which payer is slowest on prior authorization?",
      "Where are our registration errors coming from?",
      "What's the ROI of pushing registration accuracy to 99%?",
    ],
  },
  back: {
    featured: { label: "Get my back-end briefing", sub: "Denials, appeals & A/R — triaged", prompt: BACK_BRIEFING },
    suggestions: [
      "Why are our denials up, and where do they start?",
      "How are appeals performing — overturn rate and recovery?",
      "Show me the denied claims closest to their filing deadline.",
      "What would working 85% of our denials be worth?",
    ],
  },
};

const TABS: Record<Mode, {
  label: string;
  tagline: string;
  heading: string;
  blurb: string;
  suggestions: string[];
  featured?: { label: string; sub: string; prompt: string };
}> = {
  learn: {
    label: "Learn",
    tagline: "For interns — understand the revenue cycle",
    heading: "Learn the revenue cycle by asking.",
    blurb:
      "Cadence teaches the revenue cycle using Allina's live numbers as worked examples — what each metric means, why it matters, and where denials are really born.",
    suggestions: [
      "Walk me through the revenue cycle, front to back.",
      "Explain clean claim rate — what's good and what moves it?",
      "What is a prior authorization, and why do denials happen?",
      "Why are most denials 'born' on the front end?",
      "What do CARC and RARC denial codes mean?",
      "Quiz me on revenue cycle basics.",
    ],
  },
  pro: {
    label: "Productivity",
    tagline: "Department-wide — measure & act",
    heading: "Manage your revenue cycle by asking.",
    blurb:
      "Cadence pulls live numbers, traces every denial to its upstream root cause, and simulates what fixes are worth in dollars — then tells you what to do next.",
    featured: {
      label: "Get my morning briefing",
      sub: "Your top 3 priorities by revenue impact, triaged",
      prompt: BRIEFING_PROMPT,
    },
    suggestions: [
      "How is the team doing this week?",
      "What productivity metrics should we put on our dashboard?",
      "Which payer should I worry about for prior auth?",
      "Why are our denials up, and where do they start?",
    ],
  },
};

export default function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [nav, setNav] = useState<Nav>("dashboard");
  const tab: Mode = nav === "learn" ? "learn" : "pro"; // chat mode derived from the active page
  const [segment, setSegment] = useState<Segment>("all");
  const [threads, setThreads] = useState<Record<Mode, ChatMessage[]>>({ learn: [], pro: [] });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Learn tab: temporarily show the lesson grid again over an active conversation.
  const [browseLessons, setBrowseLessons] = useState(false);
  // What the user clicked on (a KPI, chart slice, or alert). Attached as context
  // to their next typed question instead of firing a canned prompt.
  const [context, setContext] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null); // lets the Stop button cancel a stream
  // Follow the streaming answer only while the user is already near the bottom,
  // so they can scroll up to read the top while the rest still loads below.
  const stickRef = useRef(true);

  const messages = threads[tab];
  const started = messages.some((m) => !m.hidden); // once a conversation begins, swap hero → composer
  // Show the entry screen when nothing's been asked, or when browsing lessons mid-conversation.
  const showWelcome = !started || (tab === "learn" && browseLessons);
  const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[], mode: Mode = tab) =>
    setThreads((prev) => ({ ...prev, [mode]: updater(prev[mode]) }));

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => {
        setOverview(d);
        setHasKey(Boolean(d.hasKey));
      })
      .catch(() => {});
  }, []);

  // Global ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (showWelcome) return; // browsing lessons — the thread isn't on screen
    if (!stickRef.current) return; // user scrolled up — don't yank them back down
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, working, showWelcome]);

  // When something is selected, focus whichever composer is on screen (hero or bottom bar).
  useEffect(() => {
    if (context) document.getElementById("cadence-composer")?.focus();
  }, [context]);

  function handleThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    // Near the bottom → keep following; scrolled up → stop following.
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(text: string, opts?: { hidden?: boolean; mode?: Mode }) {
    if (!text.trim() || busy) return;
    setBrowseLessons(false); // picking a lesson (or asking anything) returns to the thread
    stickRef.current = true; // a new question follows from the start (until the user scrolls up)
    const mode = opts?.mode ?? tab; // lock to the tab the message was sent from
    const userMsg: ChatMessage = { role: "user", text: text.trim(), hidden: opts?.hidden };
    const history = [...threads[mode], userMsg];
    setMessages(() => [...history, { role: "assistant", text: "", cards: [], tools: [] }], mode);
    setInput("");
    setBusy(true);
    setWorking(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Strip chart + suggestion markers from prior turns so the model doesn't
    // see its own placeholders.
    const wire = history.map((m) => ({
      role: m.role,
      content: m.text
        .replace(/\[\[chart:[A-Za-z0-9_]+\]\]/g, "")
        .replace(/\[\[suggest:[^\]]*\]\]/g, "")
        .trim(),
    }));

    // Typewriter: buffer streamed text and reveal it at a steady per-frame pace,
    // so the answer glides out smoothly (and the app re-renders at most once per
    // frame) instead of lurching with every network chunk.
    const queue = { text: "" };
    let raf = 0;

    const appendText = (t: string) => {
      if (!t) return;
      setWorking(null);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== "assistant") return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + t, tools: (last.tools || []).map((x) => ({ ...x, done: true })) },
        ];
      }, mode);
    };

    const pump = () => {
      raf = 0;
      const q = queue.text;
      if (!q) return;
      // Reveal ~12% of the backlog per frame (min 2 chars): a steady pace while
      // keeping up, and quickly drains the burst after a tool-call pause.
      const n = Math.max(2, Math.ceil(q.length * 0.12));
      queue.text = q.slice(n);
      appendText(q.slice(0, n));
      if (queue.text) raf = requestAnimationFrame(pump);
    };

    const flush = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      const q = queue.text;
      queue.text = "";
      appendText(q);
    };

    await streamChat(
      wire,
      mode,
      mode === "pro" ? segment : "all",
      (e) => {
        if (e.type === "text") {
          queue.text += e.text;
          if (!raf) raf = requestAnimationFrame(pump);
          return;
        }
        if (e.type === "error") flush(); // keep the error after any queued prose
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role !== "assistant") return prev;
          const updated = { ...last };
          if (e.type === "card") updated.cards = [...(last.cards || []), e.card];
          else if (e.type === "tool_use")
            updated.tools = [...(last.tools || []).map((t) => ({ ...t, done: true })), { name: e.name, done: false }];
          else if (e.type === "error") updated.text = last.text + `\n\n⚠️ ${e.message}`;
          return [...prev.slice(0, -1), updated];
        }, mode);
        if (e.type === "tool_use") setWorking(prettyTool(e.name));
      },
      controller.signal
    );

    if (controller.signal.aborted) {
      // User hit Stop — drop the unrevealed tail so the bubble matches what they saw.
      if (raf) cancelAnimationFrame(raf);
      queue.text = "";
    } else {
      flush();
    }

    // Finalize: pull the trailing [[suggest: a | b | c]] line into chips.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role !== "assistant") return prev;
      const m = /\[\[suggest:([^\]]*)\]\]/.exec(last.text);
      const suggestions = m
        ? m[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3)
        : undefined;
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          text: last.text.replace(/\[\[suggest:[^\]]*\]\]\s*/g, "").trimEnd(),
          suggestions,
          tools: (last.tools || []).map((t) => ({ ...t, done: true })),
        },
      ];
    }, mode);

    abortRef.current = null;
    setBusy(false);
    setWorking(null);
  }

  // Stop button — abort the in-flight stream and keep whatever streamed so far.
  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setWorking(null);
    // If we stopped before anything streamed, mark the empty bubble as stopped.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.text && !(last.cards && last.cards.length)) {
        return [...prev.slice(0, -1), { ...last, text: "_Stopped._" }];
      }
      return prev;
    });
  }

  // Route any AI action (dashboard drill-in, palette) into the pro chat.
  function askInChat(prompt: string, opts?: { hidden?: boolean }) {
    setNav("ask");
    send(prompt, { ...opts, mode: "pro" });
  }

  // Clicking a KPI selects it as context — the user then types their own question.
  function explainKpi(k: Kpi) {
    if (nav === "dashboard") setNav("ask"); // drilling in from the dashboard routes to the chat
    setContext(`${k.label} (${fmt(k)})`);
  }

  // Clicking a value/slice inside an answer card selects that topic as context.
  function explainTopic(topic: string) {
    if (!topic) return;
    if (nav === "dashboard") setNav("ask");
    setContext(topic);
  }

  // Stable identities for the callbacks passed to memoized Bubbles, so finished
  // messages skip re-rendering while an answer streams. The refs are re-pointed
  // every render, so the wrappers always call the closure with current state.
  const sendRef = useRef(send);
  sendRef.current = send;
  const explainRef = useRef(explainTopic);
  explainRef.current = explainTopic;
  const onBubbleSuggest = useRef((q: string) => void sendRef.current(q)).current;
  const onBubbleExplain = useRef((topic: string) => explainRef.current(topic)).current;

  // Send the user's typed question, weaving in the selected context if any.
  function submitWithContext(text: string) {
    const t = text.trim();
    if (!t && !context) return;
    const finalText = context
      ? t
        ? `Regarding "${context}": ${t}`
        : `Tell me about "${context}" — what it is, why it's where it is, and the highest-impact action. Use the data.`
      : t;
    setContext(null);
    send(finalText);
  }

  const paletteActions: PaletteAction[] = useMemo(
    () => [
      { id: "nav-dash", label: "Dashboard", hint: "KPIs, funnel & alerts", section: "Navigate", run: () => setNav("dashboard") },
      { id: "nav-ask", label: "Ask Cadence", hint: "Chat with the agent", section: "Navigate", run: () => setNav("ask") },
      { id: "nav-learn", label: "Learn", hint: "Revenue-cycle lessons", section: "Navigate", run: () => setNav("learn") },
      { id: "nav-guide", label: "Guide", hint: "What Cadence is & how to use it", section: "Navigate", run: () => setNav("guide") },
      { id: "q-brief", label: "Get my morning briefing", hint: "Top 3 priorities by revenue impact", section: "Ask Cadence", run: () => askInChat(BRIEFING_PROMPT, { hidden: true }) },
      { id: "q-triage", label: "Triage the denied-claim worklist", hint: "What to work first today", section: "Ask Cadence", run: () => askInChat("Look at the denied-claim worklist and tell me which claims my team should work first today, and why.") },
      { id: "q-payer", label: "Which payer is my biggest problem?", section: "Ask Cadence", run: () => askInChat("Which payer is my biggest problem right now? Use the payer scorecard.") },
      { id: "q-roi", label: "ROI of fixing eligibility", hint: "What-if simulation", section: "Ask Cadence", run: () => askInChat("What would it be worth to raise eligibility auto-verify to its credible ceiling?") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="flex h-full">
      <Sidebar nav={nav} setNav={setNav} openPalette={() => setPaletteOpen(true)} />

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Slim header — page context + provenance */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-900">{PAGE_LABEL[nav]}</div>
            {nav === "learn" && started && (
              <button
                onClick={() => setBrowseLessons((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                {browseLessons ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to conversation
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
                    </svg>
                    Browse lessons
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-400 lg:block">{overview?.org.name ?? "Allina Health"} · in partnership with Optum</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Mock data</span>
          </div>
        </header>

        {nav === "dashboard" ? (
          <div className="flex-1 overflow-y-auto">
            <DashboardView
              overview={overview}
              onExplainKpi={explainKpi}
              onExplainTopic={explainTopic}
              onBriefing={() => askInChat(BRIEFING_PROMPT, { hidden: true })}
            />
          </div>
        ) : nav === "guide" ? (
          <div className="flex-1 overflow-y-auto">
            <GuideView onTry={(q) => askInChat(q)} onNav={setNav} />
          </div>
        ) : (
        <>
        {!hasKey && (
          <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-800">
            No <code>ANTHROPIC_API_KEY</code> found on the server — add it to <code>.env</code> and restart to enable the agent.
          </div>
        )}

        <div ref={threadRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className={`mx-auto ${showWelcome ? "max-w-6xl" : "max-w-3xl"}`}>
            {showWelcome ? (
              <Welcome
                tab={tab}
                segment={segment}
                setSegment={setSegment}
                onPick={send}
                context={context}
                onSubmit={submitWithContext}
                onClearContext={() => setContext(null)}
              />
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) =>
                  m.hidden ? null : (
                    <Bubble key={i} m={m} busy={busy && i === messages.length - 1} onExplain={onBubbleExplain} onSuggest={onBubbleSuggest} />
                  )
                )}
                {working && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="typing-dot">●</span>
                    <span>{working}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {started && !showWelcome && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              Ask Cadence
            </div>
            {context && <ContextChip label={context} onClear={() => setContext(null)} />}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitWithContext(input);
              }}
            >
              <textarea
                id="cadence-composer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitWithContext(input);
                  }
                }}
                rows={1}
                placeholder={context ? `Ask your question about "${context}"…` : "Ask about productivity, denials, prior auth, eligibility…"}
                className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  title="Stop generating"
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center">
                    <span className="h-2.5 w-2.5 rounded-[3px] bg-rose-600" />
                  </span>
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && !context}
                  className="rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
                >
                  Ask
                </button>
              )}
            </form>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              Cadence runs on Claude over mock revenue-cycle data — every figure here is fabricated for this demo, not real Allina data. Verify before acting on real operations.
            </p>
          </div>
        </div>
        )}
        </>
        )}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} onAskFree={(q) => askInChat(q)} />
    </div>
  );
}

// ── Skinny left sidebar ──────────────────────────────────────
function Sidebar({ nav, setNav, openPalette }: { nav: Nav; setNav: (n: Nav) => void; openPalette: () => void }) {
  const items: { key: Nav; label: string; icon: React.ReactNode }[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      ),
    },
    {
      key: "ask",
      label: "Ask Cadence",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M12 3a7 7 0 0 1 7 7c0 2-1 3-1 5H6c0-2-1-3-1-5a7 7 0 0 1 7-7Z" /><path d="M9 21h6" />
        </svg>
      ),
    },
    {
      key: "learn",
      label: "Learn",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      ),
    },
    {
      key: "guide",
      label: "Guide",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },
  ];
  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
      {/* Brand */}
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold text-white">C</div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-slate-900">Cadence</div>
          <div className="text-[9.5px] text-slate-400">Rev Cycle Agent</div>
        </div>
      </div>

      <nav className="space-y-0.5">
        {items.map((it) => {
          const active = nav === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setNav(it.key)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                active ? "bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand)]" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className={active ? "text-[var(--color-brand)]" : "text-slate-400"}>{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </nav>

      {/* Command palette hint */}
      <button
        onClick={openPalette}
        className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] text-slate-400 transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Search or ask</span>
        <kbd className="rounded border border-slate-200 px-1 py-0.5 text-[9.5px] font-semibold">⌘K</kbd>
      </button>

      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-2 pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0091d6] to-[#0069b0] text-[11px] font-bold text-white">KD</div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12px] font-semibold text-slate-800">Kenlee Duong</div>
          <div className="truncate text-[10px] text-slate-400">Revenue Cycle Intern</div>
        </div>
      </div>
    </aside>
  );
}

// ── Guide — what Cadence is, what it does, and how to use it ─────────────────
const GUIDE_FEATURES = [
  {
    title: "Live KPI dashboard",
    desc: "Twelve revenue-cycle KPIs against industry benchmarks — clean claim rate, denials, days in A/R, DNFB and more — plus the cycle funnel, active alerts, and a payer scorecard.",
  },
  {
    title: "Ask anything, get sourced answers",
    desc: "Cadence is an AI agent with 15 data tools. Ask a question and it pulls the actual numbers — eligibility, prior auth, coding, denials, staffing, financials — and answers with charts spliced into the response.",
  },
  {
    title: "Root-cause tracing",
    desc: "Denials rarely start in the back office. Cadence traces each denial category to its upstream cause — a registration error, a missed auth, an eligibility gap — so fixes land where the problem starts.",
  },
  {
    title: "What-if simulation",
    desc: "Ask what it's worth to fix a metric (\"raise eligibility auto-verify to its ceiling\") and Cadence simulates the dollar impact, so improvement work can be ranked by ROI.",
  },
  {
    title: "Worklist triage",
    desc: "Ask which denied claims to work first and Cadence ranks the live worklist by dollars and appeal-deadline risk, down to the individual claim's denial code and root cause.",
  },
  {
    title: "Morning briefing",
    desc: "One click delivers the day's top three priorities ranked by revenue impact, each tied to its root cause and the single biggest lever to pull.",
  },
] as const;

const GUIDE_STEPS: { title: string; desc: string; nav?: Nav; navLabel?: string }[] = [
  {
    title: "Start on the Dashboard",
    desc: "Scan KPIs, alerts, and the funnel. Anything that looks off — click it. The number becomes context for your next question, so you can ask \"why is this red?\" without retyping anything.",
    nav: "dashboard",
    navLabel: "Open Dashboard",
  },
  {
    title: "Drill in with Ask Cadence",
    desc: "Type a question in plain English, or pick a suggestion. Use the front-end / back-end views to focus on patient access or denials & A/R. Follow-up chips keep the thread going.",
    nav: "ask",
    navLabel: "Open Ask Cadence",
  },
  {
    title: "Press ⌘K from anywhere",
    desc: "The command palette navigates, runs the morning briefing, or fires a free-form question without leaving the page you're on.",
  },
  {
    title: "Onboard staff with Learn",
    desc: "A lesson library that teaches the revenue cycle conversationally — new team members pick a card and ask follow-ups until it clicks.",
    nav: "learn",
    navLabel: "Open Learn",
  },
];

const GUIDE_QUESTIONS = [
  "Give me my morning briefing.",
  "Which payer is my biggest problem right now?",
  "Why are our denials up, and where do they start?",
  "What would it be worth to raise eligibility auto-verify to its credible ceiling?",
  "Which claims should my team work first today?",
] as const;

function GuideView({ onTry, onNav }: { onTry: (prompt: string) => void; onNav: (n: Nav) => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {/* What it is */}
      <section className="rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[#0069b0] px-6 py-7 text-white sm:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">What is Cadence?</div>
        <h1 className="mt-1.5 text-xl font-bold sm:text-2xl">An AI agent for revenue-cycle operations.</h1>
        <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-white/85">
          Cadence sits on top of revenue-cycle data and answers operational questions the way an analyst would:
          it pulls the live numbers, traces problems to their upstream root cause, and puts a dollar figure on
          what fixing them is worth — then tells you what to do next. Instead of waiting on a report, you ask.
        </p>
      </section>

      {/* What it does */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What it does</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {GUIDE_FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[13.5px] font-semibold text-slate-900">{f.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to use it */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">How to use it</h2>
        <div className="mt-3 space-y-2.5">
          {GUIDE_STEPS.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[12px] font-bold text-[var(--color-brand)]">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-slate-900">{s.title}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{s.desc}</p>
                {s.nav && (
                  <button
                    onClick={() => onNav(s.nav!)}
                    className="mt-2 text-[12px] font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    {s.navLabel} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Questions to try */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Questions to try</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {GUIDE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onTry(q)}
              className="rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)] px-3.5 py-2 text-left text-[12.5px] font-medium text-[var(--color-brand)] transition hover:brightness-105"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* Under the hood */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Under the hood</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
          Cadence runs on Claude with 15 purpose-built data tools covering eligibility, prior authorization,
          registration quality, coding, denials, staffing, trends, financials, and payer performance. When you ask a
          question, the agent decides which tools to call, reads the results, and composes the answer — the tool
          chips above each response show exactly what it looked at.
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
          <strong>Demo note:</strong> every figure in this app is mock data fabricated for demonstration — not real
          Allina data. Verify against production systems before acting on real operations.
        </p>
      </section>
    </div>
  );
}

function Welcome({
  tab,
  segment,
  setSegment,
  onPick,
  context,
  onSubmit,
  onClearContext,
}: {
  tab: Mode;
  segment: Segment;
  setSegment: (s: Segment) => void;
  onPick: (t: string, opts?: { hidden?: boolean }) => void;
  context: string | null;
  onSubmit: (text: string) => void;
  onClearContext: () => void;
}) {
  return tab === "learn" ? (
    <LearnHome onPick={onPick} />
  ) : (
    <AskHome segment={segment} setSegment={setSegment} onPick={onPick} context={context} onSubmit={onSubmit} onClearContext={onClearContext} />
  );
}

// A small pill showing what the user selected (KPI / chart slice / alert) to ask about.
function ContextChip({ label, onClear, tone = "light" }: { label: string; onClear: () => void; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div
      className={`mb-2 inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
        dark ? "bg-white/15 text-white" : "border border-[var(--color-brand)]/25 bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
        <path d="M20.59 13.41 11 3.82A2 2 0 0 0 9.59 3H4v5.59A2 2 0 0 0 4.59 10l9.59 9.59a2 2 0 0 0 2.82 0l3.59-3.59a2 2 0 0 0 0-2.82Z" /><path d="M7 7h.01" />
      </svg>
      <span className="truncate font-semibold">Asking about: {label}</span>
      <button onClick={onClear} title="Clear selection" className={`shrink-0 rounded p-0.5 ${dark ? "hover:bg-white/20" : "hover:bg-black/5"}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-3.5 w-3.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Ask Cadence entry — gradient hero with an inline composer + suggestion pills ──
function AskHome({
  segment,
  setSegment,
  onPick,
  context,
  onSubmit,
  onClearContext,
}: {
  segment: Segment;
  setSegment: (s: Segment) => void;
  onPick: (t: string, opts?: { hidden?: boolean }) => void;
  context: string | null;
  onSubmit: (text: string) => void;
  onClearContext: () => void;
}) {
  const t = TABS.pro;
  const content = PRO_SEGMENTS[segment];
  const [q, setQ] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim() || context) {
      onSubmit(q.trim());
      setQ("");
    }
  };
  return (
    <div className="animate-rise pt-2">
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-sm sm:p-7"
        style={{ background: "linear-gradient(135deg,#063a5e 0%,#0077C8 62%,#0091d6 100%)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(120,190,67,.34), transparent 65%)" }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11.5px] font-semibold">
            <span className="text-[13px] leading-none">✨</span> Ask Cadence
          </span>
          {/* Segment scope — tucked into the hero */}
          <div className="inline-flex rounded-lg border border-white/20 bg-white/10 p-0.5">
            {SEGMENTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSegment(s.key)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  segment === s.key ? "bg-white text-[var(--color-brand)]" : "text-white/80 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="relative mt-3.5 max-w-xl text-[26px] font-bold leading-tight tracking-tight">{t.heading}</h1>
        <p className="relative mt-1.5 max-w-lg text-[13.5px] text-white/85">{t.blurb}</p>

        {context && (
          <div className="relative mt-4">
            <ContextChip label={context} onClear={onClearContext} tone="dark" />
          </div>
        )}

        <form onSubmit={submit} className="relative mt-3 flex max-w-2xl items-center gap-2 rounded-xl bg-white p-1.5 pl-4 shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px] shrink-0">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="cadence-composer"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={context ? `Ask your question about "${context}"…` : "e.g. Which payer should my team focus on first?"}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-95"
          >
            Ask
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          {content.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-lg border border-white/20 bg-white/12 px-3 py-2 text-[12.5px] font-medium text-white transition hover:bg-white/25"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {content.featured && (
        <button
          onClick={() => onPick(content.featured.prompt, { hidden: true })}
          className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3 text-left transition hover:brightness-[.98]"
        >
          <span className="text-xl leading-none">☀️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">{content.featured.label}</span>
            <span className="block text-xs text-slate-600">{content.featured.sub}</span>
          </span>
          <span className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5">→</span>
        </button>
      )}
    </div>
  );
}

// ── Learn entry — rich lesson-card grid ──────────────────────
const LESSON_ICON = {
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 4h16v12H4z" /><path d="M8 20h8M12 16v4" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z" /><path d="M9 7v13M15 4v13" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  clip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h4" />
    </svg>
  ),
} as const;

type Lesson = { icon: keyof typeof LESSON_ICON; title: string; desc: string; category: string; prompt: string; featured?: boolean };

const CATEGORY_ORDER = ["Foundations", "Front-end", "Mid-cycle", "Denials", "Metrics"];

const CATALOG: Lesson[] = [
  // Foundations
  { icon: "book", title: "What is a denial?", desc: "The lifecycle from claim submission to payment, and where denials interrupt it. Start here.", category: "Foundations", featured: true, prompt: "Walk me through the revenue cycle, front to back — and explain what a denial is and where in the cycle denials happen." },
  { icon: "map", title: "Walk the revenue cycle", desc: "Front to back: eligibility → registration → coding → claims → denials → A/R.", category: "Foundations", prompt: "Walk me through the revenue cycle, front to back, and show where denials are born." },
  { icon: "doc", title: "The 835 & 837 files", desc: "The claim (837) and the remittance (835) — the two documents the whole cycle runs on.", category: "Foundations", prompt: "Explain the 837 claim and the 835 remittance — what they are and how they flow through the cycle." },
  // Front-end
  { icon: "users", title: "Eligibility & coverage", desc: "Verifying a patient's insurance before service — and why gaps here cause denials.", category: "Front-end", prompt: "Explain eligibility verification — what it is, why it matters, and how we're doing." },
  { icon: "shield", title: "Prior authorization", desc: "What prior auth is, how the workflow runs, and why it's such a common denial cause.", category: "Front-end", featured: true, prompt: "What is a prior authorization, and why do denials happen?" },
  { icon: "clip", title: "Registration & patient access", desc: "Getting demographics and insurance right at the front desk — the first line of defense.", category: "Front-end", prompt: "Explain patient registration and access quality, and why registration errors cause downstream denials." },
  { icon: "money", title: "Point-of-service collections", desc: "Collecting patient responsibility up front — what good looks like and why it matters.", category: "Front-end", prompt: "Explain point-of-service collections — what it is, what a good rate looks like, and how we're doing." },
  // Mid-cycle
  { icon: "code", title: "Medical coding basics", desc: "How clinical care becomes billable codes — and where coding denials come from.", category: "Mid-cycle", prompt: "Explain medical coding basics and how coding accuracy drives denials." },
  { icon: "check", title: "Clean claim rate", desc: "What a clean claim is, what's a good rate, and the levers that actually move it.", category: "Mid-cycle", featured: true, prompt: "Explain clean claim rate — what's good and what moves it?" },
  { icon: "doc", title: "Charge capture & DNFB", desc: "Making sure every service is billed, and why discharged-not-final-billed matters.", category: "Mid-cycle", prompt: "Explain charge capture and DNFB (discharged not final billed) — what they are and why they matter." },
  { icon: "clip", title: "Clinical documentation (CDI)", desc: "Why documentation quality changes coding, reimbursement, and denials.", category: "Mid-cycle", prompt: "Explain clinical documentation improvement (CDI) and how it affects reimbursement and denials." },
  // Denials
  { icon: "code", title: "Reading a CARC / RARC code", desc: "Decode CO-197, CO-16 and friends — what the payer is telling you, using our real denied claims.", category: "Denials", featured: true, prompt: "What do CARC and RARC denial codes mean? Use real claims from our worklist as examples of CO-197 and CO-50, and how to respond." },
  { icon: "users", title: "Why denials are 'born' up front", desc: "Most denials start at registration & eligibility — see why, with our own numbers.", category: "Denials", featured: true, prompt: "Why are most denials 'born' on the front end? Use our data to show it." },
  { icon: "shield", title: "The appeals process", desc: "How to fight a denial — appeals, overturn rate, and recovering written-off dollars.", category: "Denials", prompt: "Explain the denial appeals process — how appeals work, overturn rate, and recovering dollars. Use our actual appeal numbers." },
  // Metrics
  { icon: "money", title: "Days in A/R, explained", desc: "Why this number is the pulse of your operation, how it's calculated, and what “good” looks like.", category: "Metrics", featured: true, prompt: "Explain days in A/R like I'm new to the revenue cycle — how it's calculated, what's a good benchmark, and what moves it." },
  { icon: "money", title: "Net collection rate", desc: "The share of collectible dollars you actually collect — the bottom-line health metric.", category: "Metrics", prompt: "Explain net collection rate — what it is, what's good, and what moves it." },
];

function LearnHome({ onPick }: { onPick: (t: string) => void }) {
  const [libOpen, setLibOpen] = useState(false);
  const featured = CATALOG.filter((l) => l.featured);
  return (
    <div className="animate-rise pt-2">
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Learn the revenue cycle</h1>
        <button onClick={() => setLibOpen(true)} className="text-[12.5px] font-semibold text-[var(--color-brand)] hover:underline">
          Browse all lessons →
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((l) => (
          <button
            key={l.title}
            onClick={() => onPick(l.prompt)}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:shadow-md"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              {LESSON_ICON[l.icon]}
            </span>
            <span className="text-[15px] font-bold text-slate-900">{l.title}</span>
            <span className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{l.desc}</span>
            <span className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-brand)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              {l.category}
            </span>
          </button>
        ))}
      </div>
      {libOpen && (
        <LessonLibrary
          onClose={() => setLibOpen(false)}
          onPick={(p) => {
            setLibOpen(false);
            onPick(p);
          }}
        />
      )}
    </div>
  );
}

// Searchable lesson library — opened from "Browse all lessons".
function LessonLibrary({ onClose, onPick }: { onClose: () => void; onPick: (prompt: string) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = CATALOG.filter(
    (l) => !query || l.title.toLowerCase().includes(query) || l.desc.toLowerCase().includes(query) || l.category.toLowerCase().includes(query)
  );
  const cats = CATEGORY_ORDER.filter((c) => filtered.some((l) => l.category === c));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[8vh]" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900">Lesson library</h2>
            <button onClick={onClose} title="Close" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[var(--color-brand-soft)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search lessons…"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Grouped list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {cats.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">No lessons match “{q}”.</div>
          ) : (
            cats.map((cat) => (
              <div key={cat} className="mb-1">
                <div className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{cat}</div>
                {filtered
                  .filter((l) => l.category === cat)
                  .map((l) => (
                    <button
                      key={l.title}
                      onClick={() => onPick(l.prompt)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                        {LESSON_ICON[l.icon]}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-slate-900">{l.title}</span>
                        <span className="block truncate text-[11.5px] text-slate-500">{l.desc}</span>
                      </span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Memoized: while an answer streams, only the streaming bubble re-renders —
// message objects keep their identity and the App passes stable callbacks.
const Bubble = memo(function Bubble({
  m,
  busy,
  onExplain,
  onSuggest,
}: {
  m: ChatMessage;
  busy: boolean;
  onExplain: (topic: string) => void;
  onSuggest: (q: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-ink)] px-4 py-2.5 text-sm text-white">{m.text}</div>
      </div>
    );
  }
  // Splice each chart into the prose where the model dropped its [[chart:id]]
  // marker; any card the model didn't reference falls to the bottom (nothing lost).
  const cards = m.cards || [];
  const byId = new Map(cards.filter((c) => c.chartId).map((c) => [c.chartId as string, c]));
  const used = new Set<string>();
  const nodes: React.ReactNode[] = [];
  // Hide the suggest marker (and any half-streamed [[ token) from display.
  const text = (m.text || "")
    .replace(/\[\[suggest:[^\]]*\]\]\s*/g, "")
    .replace(/\[\[[^\]]*$/, "");
  const re = /\[\[chart:([A-Za-z0-9_]+)\]\]/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const seg = text.slice(last, match.index);
    if (seg.trim()) nodes.push(<Markdown key={key++}>{seg}</Markdown>);
    const card = byId.get(match[1]);
    if (card && !used.has(match[1])) {
      used.add(match[1]);
      nodes.push(<CardView key={key++} card={card} onExplain={onExplain} />);
    }
    last = re.lastIndex;
  }
  const tail = text.slice(last);
  if (tail.trim()) nodes.push(<Markdown key={key++}>{tail}</Markdown>);
  const leftover = cards.filter((c) => !(c.chartId && used.has(c.chartId)));

  return (
    <div className="animate-rise space-y-3">
      {/* Tool timeline — what the agent did to build this answer */}
      {(m.tools?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {m.tools!.map((t, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${
                t.done
                  ? "border-slate-200 bg-slate-50 text-slate-400"
                  : "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
              }`}
            >
              {t.done ? "✓" : <span className="typing-dot">●</span>}
              {prettyToolShort(t.name)}
            </span>
          ))}
        </div>
      )}
      {nodes}
      {leftover.map((c, i) => <CardView key={`lo${i}`} card={c} onExplain={onExplain} />)}
      {/* AI follow-up chips */}
      {!busy && (m.suggestions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {m.suggestions!.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-brand)] transition hover:brightness-105"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

function KpiCard({ k, onExplain }: { k: Kpi; onExplain: (k: Kpi) => void }) {
  const good = k.goodDirection === "up" ? k.value >= k.benchmark : k.value <= k.benchmark;
  const arrow = k.trend === "flat" ? "→" : k.trend === "up" ? "▲" : "▼";
  const dot = k.stage === "front" ? "var(--color-brand)" : k.stage === "mid" ? "var(--color-accent)" : "#00838f";
  return (
    <button
      onClick={() => onExplain(k)}
      title={`Explain ${k.label} · benchmark ${fmtVal(k.benchmark, k.unit)}`}
      className="group flex min-w-[112px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:border-[var(--color-brand)]"
    >
      <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-slate-500">
        <span className="h-1 w-1 rounded-full" style={{ background: dot }} />
        {k.label}
      </span>
      <span className="mt-0.5 flex items-baseline gap-1">
        <span className="text-sm font-semibold text-slate-900">{fmt(k)}</span>
        <span className={`text-[10px] ${good ? "text-[var(--color-accent)]" : "text-rose-500"}`}>{arrow}</span>
        <span className="text-[9px] text-slate-400">· {fmtVal(k.benchmark, k.unit)}</span>
      </span>
    </button>
  );
}

function fmt(k: Kpi) {
  return fmtVal(k.value, k.unit);
}

function fmtVal(value: number, unit: string) {
  if (unit === "$/mo") return `$${Math.round(value / 1000)}K`;
  if (unit === "%") return `${value}%`;
  if (unit === "days") return `${value}d`;
  if (unit === "hrs") return `${value}h`;
  return `${value}`;
}

const TOOL_LABEL: Record<string, [progress: string, short: string]> = {
  get_kpi_overview: ["Pulling KPI overview…", "KPI overview"],
  get_eligibility_stats: ["Checking eligibility performance…", "Eligibility"],
  get_prior_auth_stats: ["Analyzing prior auth…", "Prior auth"],
  get_registration_quality: ["Reviewing registration quality…", "Registration"],
  get_coding_productivity: ["Reviewing coding productivity…", "Coding"],
  get_denials: ["Breaking down denials…", "Denials"],
  get_staff_productivity: ["Reviewing team productivity…", "Team"],
  get_trend: ["Plotting the trend…", "Trend"],
  get_financial_summary: ["Checking cash & A/R…", "Cash & A/R"],
  get_alerts: ["Scanning for revenue leaks…", "Alerts"],
  get_payer_scorecard: ["Scoring the payers…", "Payer scorecard"],
  get_cycle_funnel: ["Mapping the claim flow…", "Claim funnel"],
  get_claims_worklist: ["Pulling the denied-claim worklist…", "Worklist"],
  get_claim_detail: ["Opening the claim…", "Claim detail"],
  simulate_improvement: ["Running the what-if…", "ROI simulation"],
};

function prettyTool(name: string) {
  return TOOL_LABEL[name]?.[0] || "Working…";
}
function prettyToolShort(name: string) {
  return TOOL_LABEL[name]?.[1] || name;
}
