import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Alert, FunnelStep, Kpi, Overview } from "../types";

// The Dashboard page — command header, a Front → Mid → Back flow rail that acts
// as a segmented control, sparkline KPI tiles, this month's claim funnel, and
// live alerts. Everything is wired to /api/overview data and click-to-ask.

type Stage = "front" | "mid" | "back";

const STAGES: { key: Stage; name: string; caption: string }[] = [
  { key: "front", name: "Front-End", caption: "Access & registration" },
  { key: "mid", name: "Mid-Cycle", caption: "Clinical & coding" },
  { key: "back", name: "Back-End", caption: "Billing & collections" },
];

// Stage accent — front blue, mid green, back teal (matches the KPI dots elsewhere).
const ACCENT: Record<Stage, { c: string; soft: string }> = {
  front: { c: "var(--color-brand)", soft: "var(--color-brand-soft)" },
  mid: { c: "var(--color-accent)", soft: "var(--color-accent-soft)" },
  back: { c: "#00838f", soft: "#e0f2f4" },
};

function isGood(k: Kpi) {
  return k.goodDirection === "up" ? k.value >= k.benchmark : k.value <= k.benchmark;
}
function health(kpis: Kpi[]): "ok" | "warn" | "bad" {
  if (!kpis.length) return "warn";
  const ratio = kpis.filter(isGood).length / kpis.length;
  return ratio >= 0.75 ? "ok" : ratio >= 0.4 ? "warn" : "bad";
}
const HEALTH_LABEL = { ok: "Healthy", warn: "At risk", bad: "Needs work" } as const;
const HEALTH_DOT = { ok: "bg-[var(--color-accent)]", warn: "bg-amber-500", bad: "bg-rose-500" } as const;

function fmt(value: number, unit: string) {
  if (unit === "$/mo") return `$${Math.round(value / 1000)}K`;
  if (unit === "%") return `${value}%`;
  if (unit === "days") return `${value}d`;
  if (unit === "hrs") return `${value}h`;
  return `${value}`;
}

export default function DashboardView({
  overview,
  onExplainKpi,
  onExplainTopic,
  onBriefing,
}: {
  overview: Overview | null;
  onExplainKpi: (k: Kpi) => void;
  onExplainTopic: (topic: string) => void;
  onBriefing: () => void;
}) {
  const [stage, setStage] = useState<Stage>("front");
  const kpis = overview?.kpis ?? [];
  const alerts = overview?.alerts ?? [];
  const funnel = overview?.funnel ?? [];

  const byStage = (s: Stage) => kpis.filter((k) => k.stage === s);
  const stageKpis = byStage(stage);
  const stageAlerts = alerts.filter((a) => a.stage === stage);
  const A = ACCENT[stage];

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      {/* ── Command header: cash goal + briefing CTA ─────────── */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-6"
        style={{ background: "linear-gradient(120deg,#063a5e 0%,#0077C8 62%,#0091d6 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(120,190,67,.3), transparent 65%)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-widest text-white/60">
              {overview?.org.name ?? "…"} · as of {overview?.org.asOf ?? "—"}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Revenue cycle command center</h1>
          </div>
          <button
            onClick={onBriefing}
            className="group flex items-center gap-2.5 rounded-xl border border-white/25 bg-white/12 px-4 py-3 text-left backdrop-blur transition hover:bg-white/20"
          >
            <span className="text-xl leading-none">☀️</span>
            <span>
              <span className="block text-[13.5px] font-bold">Get my morning briefing</span>
              <span className="block text-[11px] text-white/70">Cadence triages today's top 3 by revenue impact</span>
            </span>
            <span className="text-white/70 transition group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>

      {/* ── Flow rail (segmented control) ─────────────────────── */}
      <div className="mb-5 flex max-w-3xl items-center">
        {STAGES.map((s, i) => {
          const ks = byStage(s.key);
          const h = health(ks);
          const active = stage === s.key;
          const acc = ACCENT[s.key];
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <button
                onClick={() => setStage(s.key)}
                className={`flex flex-1 items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left transition hover:-translate-y-px ${
                  active ? "border-transparent shadow-sm ring-2" : "border-slate-200"
                }`}
                style={active ? ({ "--tw-ring-color": acc.c } as React.CSSProperties) : undefined}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: acc.soft, color: acc.c }}>
                  {STAGE_ICON[s.key]}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13px] font-semibold text-slate-900">{s.name}</span>
                  <span className="block truncate text-[10.5px] text-slate-400">{s.caption}</span>
                </span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[h]}`} title={HEALTH_LABEL[h]} />
              </button>
              {i < STAGES.length - 1 && (
                <span className="shrink-0 px-1.5 text-slate-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Sparkline KPI tiles for the active stage ──────────── */}
      <div className="grid grid-cols-12 gap-4">
        {stageKpis.map((k) => (
          <SparkTile key={k.id} k={k} onClick={() => onExplainKpi(k)} />
        ))}

        {/* Claim funnel */}
        <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
          <div className="text-[13px] font-semibold text-slate-900">This month's claim flow</div>
          <div className="mb-3 text-[11px] text-slate-400">
            {overview ? `${overview.org.monthlyClaimVolume.toLocaleString()} claims · click a step to ask why` : "Loading…"}
          </div>
          <Funnel steps={funnel} onAsk={onExplainTopic} />
        </div>

        {/* Alerts for this stage */}
        <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-900">Alerts — {STAGES.find((s) => s.key === stage)!.name}</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">{stageAlerts.length}</span>
          </div>
          <div className="space-y-1.5">
            {stageAlerts.length ? (
              stageAlerts.map((a) => (
                <button
                  key={a.title}
                  onClick={() => onExplainTopic(a.title)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${a.severity === "high" ? "bg-rose-500" : "bg-amber-500"}`} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-slate-800">{a.title}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{a.detail}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="py-3 text-center text-xs text-slate-400">No active alerts in this stage.</div>
            )}
          </div>
          <div className="mt-3 rounded-xl border p-3" style={{ background: A.soft, borderColor: A.c }}>
            <div className="text-[12px] font-semibold text-slate-900">⚡ Where to look</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-700">{worstInsight(stageKpis, stageAlerts)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI tile with a live sparkline of its 13-week history.
function SparkTile({ k, onClick }: { k: Kpi; onClick: () => void }) {
  const good = isGood(k);
  const data = (k.spark ?? []).map((v, i) => ({ i, v }));
  const gid = `spark-${k.id}`;
  const color = good ? "#78be43" : "#f43f5e";
  return (
    <button
      onClick={onClick}
      title={`Ask Cadence about ${k.label}`}
      className="group col-span-6 flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:col-span-4 lg:col-span-3"
    >
      <span className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-slate-500">{k.label}</span>
        <span className={`text-[10px] font-bold ${good ? "text-[var(--color-accent)]" : "text-rose-500"}`}>
          {k.trend === "flat" ? "→" : k.trend === "up" ? "▲" : "▼"}
        </span>
      </span>
      <span className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{fmt(k.value, k.unit)}</span>
      <span className="mt-0.5 text-[10.5px] text-slate-400">
        target {fmt(k.benchmark, k.unit)} · best {fmt(k.bestInClass, k.unit)}
      </span>
      {data.length > 1 && (
        <span className="mt-2 block h-9 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </span>
      )}
    </button>
  );
}

function Funnel({ steps, onAsk }: { steps: FunnelStep[]; onAsk: (t: string) => void }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const pct = Math.max(10, Math.round((s.count / max) * 100));
        const leak = i === 2;
        return (
          <button key={s.stage} onClick={() => onAsk(s.stage)} className="group flex w-full items-center gap-3 text-left" title={`Ask about ${s.stage}`}>
            <span className="w-40 shrink-0 truncate text-[11.5px] font-medium text-slate-600">{s.stage}</span>
            <span className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
              <span
                className="absolute inset-y-0 left-0 flex items-center rounded-md px-2 text-[11px] font-bold text-white transition-all group-hover:brightness-110"
                style={{
                  width: `${pct}%`,
                  background: leak ? "linear-gradient(90deg,#f43f5e,#fb7185)" : `linear-gradient(90deg,#005a99,${i >= 3 ? "#78be43" : "#0077c8"})`,
                }}
              >
                {s.count.toLocaleString()}
              </span>
            </span>
            <span className="hidden w-48 shrink-0 truncate text-[10.5px] text-slate-400 md:block">{s.note}</span>
          </button>
        );
      })}
    </div>
  );
}

function worstInsight(kpis: Kpi[], alerts: Alert[]): string {
  const high = alerts.find((a) => a.severity === "high") || alerts[0];
  if (high) return high.detail;
  const worst = [...kpis].filter((k) => !isGood(k)).sort((a, b) => Math.abs(b.value - b.benchmark) - Math.abs(a.value - a.benchmark))[0];
  if (worst) return `${worst.label} is off target (${fmt(worst.value, worst.unit)} vs ${fmt(worst.benchmark, worst.unit)}). Click it to trace the cause.`;
  return "All metrics in this stage are at or above target. Nothing needs attention right now.";
}

const STAGE_ICON: Record<Stage, React.ReactNode> = {
  front: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    </svg>
  ),
  mid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
};
