import { useEffect, useRef, useState } from "react";
import { streamChat, type Mode } from "./api";
import CardView from "./components/CardView";
import Markdown from "./components/Markdown";
import type { Alert, ChatMessage, Kpi } from "./types";

// Seeds the morning briefing. Phrased to lean on get_alerts + get_kpi_overview
// and to render well through the markdown component (headline → list → lever).
const BRIEFING_PROMPT =
  "Good morning — give me my daily briefing. Pull the active alerts and the KPI overview first, then respond with exactly: a one-sentence headline on how the revenue cycle is doing today; then a `## Today's top 3 priorities` numbered list, each ranked by revenue impact with the dollar figure and its upstream root cause; then one closing sentence naming the single biggest lever to pull. Keep it tight and scannable — no preamble.";

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
      "Cadence pulls live productivity and denial numbers, narrates what changed, and helps decide what to put on your Power BI dashboard — then tells you what to do about it.",
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
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [orgName, setOrgName] = useState("Allina Health");
  const [hasKey, setHasKey] = useState(true);
  const [tab, setTab] = useState<Mode>("learn");
  const [threads, setThreads] = useState<Record<Mode, ChatMessage[]>>({ learn: [], pro: [] });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const messages = threads[tab];
  const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[], mode: Mode = tab) =>
    setThreads((prev) => ({ ...prev, [mode]: updater(prev[mode]) }));

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => {
        setKpis(d.kpis || []);
        setAlerts(d.alerts || []);
        setOrgName(d.org?.name || orgName);
        setHasKey(Boolean(d.hasKey));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, working]);

  async function send(text: string, opts?: { hidden?: boolean }) {
    if (!text.trim() || busy) return;
    const mode = tab; // lock to the tab the message was sent from
    const userMsg: ChatMessage = { role: "user", text: text.trim(), hidden: opts?.hidden };
    const history = [...threads[mode], userMsg];
    setMessages(() => [...history, { role: "assistant", text: "", cards: [], tools: [] }], mode);
    setInput("");
    setBusy(true);
    setWorking(null);

    const wire = history.map((m) => ({ role: m.role, content: m.text }));

    await streamChat(wire, mode, (e) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role !== "assistant") return prev;
        const updated = { ...last };
        if (e.type === "text") updated.text = last.text + e.text;
        else if (e.type === "card") updated.cards = [...(last.cards || []), e.card];
        else if (e.type === "tool_use") updated.tools = [...(last.tools || []), e.name];
        else if (e.type === "error") updated.text = last.text + `\n\n⚠️ ${e.message}`;
        return [...prev.slice(0, -1), updated];
      }, mode);
      if (e.type === "tool_use") setWorking(prettyTool(e.name));
      if (e.type === "text") setWorking(null);
    });

    setBusy(false);
    setWorking(null);
  }

  const front = kpis.filter((k) => k.stage === "front");
  const rest = kpis.filter((k) => k.stage !== "front");

  return (
    <div className="flex h-full">
      {/* ── Left rail ─────────────────────────────────────────── */}
      <aside className="hidden w-80 shrink-0 flex-col bg-[var(--color-ink)] text-slate-200 lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)] text-sm font-bold text-white">C</div>
          <div>
            <div className="text-sm font-semibold text-white">Cadence</div>
            <div className="text-[11px] text-slate-400">Rev Cycle Copilot</div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide">
            <span className="text-[var(--color-brand)]">{orgName.split(" ")[0]}</span>{" "}
            <span className="text-[var(--color-accent)]">{orgName.split(" ").slice(1).join(" ")}</span>
          </div>
          <div className="text-[11px] text-slate-500">Serviced by Optum · synthetic demo data</div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <RailSection label="Front-end" accent>
            {front.map((k) => <KpiRow key={k.id} k={k} />)}
          </RailSection>
          <RailSection label="Mid & back-end">
            {rest.map((k) => <KpiRow key={k.id} k={k} />)}
          </RailSection>

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Active alerts</div>
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.title} className="rounded-lg bg-white/5 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${a.severity === "high" ? "bg-rose-400" : "bg-amber-400"}`} />
                    <span className="text-xs font-medium text-slate-100">{a.title}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mode tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-8">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(Object.keys(TABS) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setTab(m)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  tab === m
                    ? "bg-white text-[var(--color-brand)] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {TABS[m].label}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-slate-400 sm:block">{TABS[tab].tagline}</span>
        </div>

        {!hasKey && (
          <div className="bg-amber-50 px-6 py-2 text-center text-xs text-amber-800">
            No <code>ANTHROPIC_API_KEY</code> found on the server — add it to <code>.env</code> and restart to enable the agent.
          </div>
        )}

        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {messages.filter((m) => !m.hidden).length === 0 ? (
              <Welcome tab={tab} onPick={send} />
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (m.hidden ? null : <Bubble key={i} m={m} />))}
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

        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-8">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about productivity, denials, prior auth, eligibility…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
            >
              {busy ? "…" : "Ask"}
            </button>
          </form>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-slate-400">
            Cadence runs on Claude Opus 4.8 over synthetic revenue-cycle data. Verify before acting on real operations.
          </p>
        </div>
      </main>
    </div>
  );
}

function Welcome({ tab, onPick }: { tab: Mode; onPick: (t: string, opts?: { hidden?: boolean }) => void }) {
  const t = TABS[tab];
  return (
    <div className="animate-rise pt-6">
      <h1 className="text-2xl font-semibold text-slate-900">{t.heading}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-500">{t.blurb}</p>

      {t.featured && (
        <button
          onClick={() => onPick(t.featured!.prompt, { hidden: true })}
          className="group mt-6 flex w-full items-center gap-3 rounded-xl bg-[var(--color-brand)] px-4 py-3.5 text-left shadow-sm ring-1 ring-black/5 transition hover:brightness-105"
        >
          <span className="text-xl leading-none">☀️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">{t.featured.label}</span>
            <span className="block text-xs text-white/80">{t.featured.sub}</span>
          </span>
          <span className="shrink-0 text-white/90 transition group-hover:translate-x-0.5">→</span>
        </button>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {t.suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-[var(--color-brand)] hover:shadow-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-ink)] px-4 py-2.5 text-sm text-white">{m.text}</div>
      </div>
    );
  }
  return (
    <div className="animate-rise space-y-3">
      {m.cards && m.cards.length > 0 && (
        <div className="space-y-3">{m.cards.map((c, i) => <CardView key={i} card={c} />)}</div>
      )}
      {m.text && <Markdown>{m.text}</Markdown>}
    </div>
  );
}

function RailSection({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${accent ? "text-[var(--color-brand)]" : "text-slate-400"}`}>
        {accent && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />}
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KpiRow({ k }: { k: Kpi }) {
  const good = k.goodDirection === "up" ? k.value >= k.benchmark : k.value <= k.benchmark;
  const arrow = k.trend === "flat" ? "→" : k.trend === "up" ? "▲" : "▼";
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
      <span className="text-xs text-slate-300">{k.label}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-white">{fmt(k)}</span>
        <span className={`text-[10px] ${good ? "text-[var(--color-accent)]" : "text-rose-400"}`}>{arrow}</span>
      </span>
    </div>
  );
}

function fmt(k: Kpi) {
  if (k.unit === "$/mo") return `$${Math.round(k.value / 1000)}K`;
  if (k.unit === "%") return `${k.value}%`;
  if (k.unit === "days") return `${k.value}d`;
  if (k.unit === "hrs") return `${k.value}h`;
  return `${k.value}`;
}

function prettyTool(name: string) {
  const map: Record<string, string> = {
    get_kpi_overview: "Pulling KPI overview…",
    get_eligibility_stats: "Checking eligibility performance…",
    get_prior_auth_stats: "Analyzing prior auth…",
    get_registration_quality: "Reviewing registration quality…",
    get_coding_productivity: "Reviewing coding productivity…",
    get_denials: "Breaking down denials…",
    get_staff_productivity: "Reviewing team productivity…",
    get_trend: "Plotting the trend…",
    get_financial_summary: "Checking cash & A/R…",
    get_alerts: "Scanning for revenue leaks…",
  };
  return map[name] || "Working…";
}
