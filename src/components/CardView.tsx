import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Card, Column } from "../types";

const PALETTE = ["#0077c8", "#78be43", "#0b1220", "#00a3b4", "#5b8def", "#2c6e49"];
const STAGE_DOT: Record<string, string> = { front: "#0077c8", mid: "#78be43", back: "#00838f" };

// onExplain: clicking a value inside a card drills into that topic with a follow-up question.
export default function CardView({ card, onExplain }: { card: Card; onExplain?: (topic: string) => void }) {
  return (
    <div className="animate-rise rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
        {"subtitle" in card && card.subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{card.subtitle}</p>
        )}
      </div>
      {render(card, onExplain)}
    </div>
  );
}

function render(card: Card, onExplain?: (topic: string) => void) {
  const ask = (topic: string) => onExplain?.(String(topic ?? "").trim());

  switch (card.type) {
    case "stat":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {card.stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => ask(s.label)}
              title={`Ask about ${s.label}`}
              className="rounded-lg bg-slate-50 p-3 text-left transition hover:bg-slate-100 hover:ring-1 hover:ring-[var(--color-brand-soft)]"
            >
              <div className="flex items-center gap-1.5">
                {s.stage && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_DOT[s.stage] }} />}
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-slate-900">{s.value}</span>
                {s.trend && <TrendArrow trend={s.trend} good={s.good} />}
              </div>
              {s.benchmark && <div className="text-[11px] text-slate-400">{s.benchmark}</div>}
            </button>
          ))}
        </div>
      );

    case "bar":
      return (
        <ResponsiveContainer width="100%" height={Math.max(180, card.data.length * 34)}>
          <BarChart data={card.data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="#eef1f5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis type="category" dataKey={card.xKey} width={150} tick={{ fontSize: 11, fill: "#334155" }} />
            <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tooltipStyle} />
            {card.series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                radius={[0, 4, 4, 0]}
                fill={PALETTE[i % PALETTE.length]}
                cursor={onExplain ? "pointer" : undefined}
                onClick={(d: any) => ask(d?.payload?.[card.xKey] ?? d?.[card.xKey])}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case "line":
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={card.data} margin={{ left: 0, right: 12, top: 6 }}>
            <CartesianGrid stroke="#eef1f5" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={36} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#0077c8" strokeWidth={2.5} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case "donut":
      return (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <ResponsiveContainer width="100%" height={190} className="sm:!w-1/2">
            <PieChart>
              <Pie
                data={card.data}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                cursor={onExplain ? "pointer" : undefined}
                onClick={(d: any) => ask(d?.name ?? d?.payload?.name)}
              >
                {card.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="w-full space-y-1.5 sm:w-1/2">
            {card.data.map((d, i) => (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => ask(d.name)}
                  title={`Ask about ${d.name}`}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="font-semibold text-slate-900">{d.value}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                {card.columns.map((c) => <th key={c.key} className="px-2 py-1.5 font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {card.rows.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => ask(row.id ?? row.name ?? row[card.columns[0]?.key])}
                  title="Ask about this row"
                  className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                >
                  {card.columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5">{formatCell(row[c.key], c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "alerts":
      return (
        <ul className="space-y-2">
          {card.alerts.map((a) => (
            <li key={a.title}>
              <button
                type="button"
                onClick={() => ask(a.title)}
                title={`Ask about "${a.title}"`}
                className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${a.severity === "high" ? "bg-rose-100 text-rose-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{a.severity}</span>
                  <span className="text-sm font-semibold text-slate-900">{a.title}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{a.detail}</p>
              </button>
            </li>
          ))}
        </ul>
      );

    case "funnel": {
      const max = Math.max(...card.steps.map((s) => s.count), 1);
      return (
        <div className="space-y-1.5">
          {card.steps.map((s, i) => {
            const pct = Math.max(10, Math.round((s.count / max) * 100));
            const leak = i === 2; // "denied" is the leak step
            return (
              <button
                key={s.stage}
                type="button"
                onClick={() => ask(s.stage)}
                title={`Ask about ${s.stage}`}
                className="group flex w-full items-center gap-3 text-left"
              >
                <span className="w-40 shrink-0 truncate text-[11.5px] font-medium text-slate-600">{s.stage}</span>
                <span className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <span
                    className="absolute inset-y-0 left-0 flex items-center rounded-md px-2 text-[11px] font-bold text-white transition-all group-hover:brightness-110"
                    style={{
                      width: `${pct}%`,
                      background: leak
                        ? "linear-gradient(90deg,#f43f5e,#fb7185)"
                        : `linear-gradient(90deg,#005a99,${i >= 3 ? "#78be43" : "#0077c8"})`,
                    }}
                  >
                    {s.count.toLocaleString()}
                  </span>
                </span>
                <span className="hidden w-52 shrink-0 truncate text-[10.5px] text-slate-400 sm:block">{s.note}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case "impact": {
      const span = Math.max(card.ceiling - Math.min(card.current, card.target), 0.0001);
      const curPct = 0;
      const tgtPct = Math.round(((card.target - card.current) / span) * 100);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <ImpactStat label="Monthly recovery" value={`$${abbr(card.monthlyDollars)}`} tone="accent" />
            <ImpactStat label="Annualized" value={`$${abbr(card.annualDollars)}`} tone="brand" />
            <ImpactStat label="Denials prevented /mo" value={card.denialsPrevented ? card.denialsPrevented.toLocaleString() : "—"} tone="teal" />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
              <span>Now: <b className="text-slate-900">{card.current}{card.unit}</b></span>
              <span>Target: <b className="text-[var(--color-accent)]">{card.target}{card.unit}</b></span>
              <span>Credible ceiling: {card.ceiling}{card.unit}</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
              <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.max(curPct, 4)}%` }} />
              <span
                className="absolute inset-y-0 rounded-full bg-[var(--color-accent)]/70"
                style={{ left: `${Math.max(curPct, 4)}%`, width: `${Math.min(Math.max(tgtPct, 4), 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Linear estimate off the current book of business — directional, not a promise.</p>
        </div>
      );
    }

    case "claim": {
      const c = card.claim;
      const urgent = c.deadlineDays <= 14;
      return (
        <div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <ClaimField label="Payer" value={c.payer} />
            <ClaimField label="Service" value={c.service} />
            <ClaimField label="Date of service" value={c.dos} />
            <ClaimField label="Amount" value={`$${c.amount.toLocaleString()}`} strong />
            <ClaimField label="CARC" value={`${c.carc}`} />
            <ClaimField label="Appeal deadline" value={`${c.deadlineDays} days`} bad={urgent} />
            <ClaimField label="Age" value={`${c.ageDays} days`} />
            <ClaimField label="Status" value={c.status.replace("_", " ")} />
            <ClaimField label="Assigned to" value={c.assignedTo} />
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Denial reason</div>
            <div className="mt-0.5 text-xs text-slate-900">{c.reason}{c.carcMeaning ? ` — ${c.carcMeaning}` : ""}</div>
            <div className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Root cause</div>
            <div className="mt-0.5 text-xs font-medium" style={{ color: STAGE_DOT[c.stage] }}>{c.rootCause}</div>
          </div>
        </div>
      );
    }

  }
}

function ImpactStat({ label, value, tone }: { label: string; value: string; tone: "accent" | "brand" | "teal" }) {
  const map = { accent: "#4d8b27", brand: "var(--color-brand)", teal: "#00838f" } as const;
  const soft = { accent: "var(--color-accent-soft)", brand: "var(--color-brand-soft)", teal: "#e0f2f4" } as const;
  return (
    <div className="rounded-lg p-3" style={{ background: soft[tone] }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold tracking-tight" style={{ color: map[tone] }}>{value}</div>
    </div>
  );
}

function ClaimField({ label, value, strong, bad }: { label: string; value: string; strong?: boolean; bad?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-[13px] ${bad ? "font-semibold text-rose-600" : strong ? "font-semibold text-slate-900" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function formatCell(v: any, c: Column) {
  if (v === undefined || v === null) return <span className="text-slate-400">—</span>;
  switch (c.format) {
    case "pct":
      return <span className="text-slate-600">{v}%</span>;
    case "prod":
      return (
        <span className={`rounded px-1.5 py-0.5 font-semibold ${v >= 100 ? "bg-emerald-50 text-emerald-700" : v >= 90 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{v}%</span>
      );
    case "queue":
      return <span className={v > 80 ? "font-semibold text-rose-600" : "text-slate-600"}>{v}</span>;
    case "money":
      return <span className="font-semibold text-slate-900">${Number(v).toLocaleString()}</span>;
    case "deadline":
      return <span className={`rounded px-1.5 py-0.5 font-semibold ${v <= 14 ? "bg-rose-50 text-rose-700" : v <= 45 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{v}d</span>;
    case "heat_low": // lower is better
    case "heat_high": // higher is better
      return <span className="font-medium text-slate-900">{v}</span>;
    default:
      if (c.key === "name" || c.key === "id" || c.key === "payer") return <span className="font-medium text-slate-900">{v}</span>;
      return <span className="text-slate-600">{v}</span>;
  }
}

function abbr(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return `${v}`;
}

function TrendArrow({ trend, good }: { trend: "up" | "down" | "flat"; good?: boolean }) {
  if (trend === "flat") return <span className="text-xs text-slate-400">→</span>;
  const color = good === undefined ? "text-slate-400" : good ? "text-[var(--color-accent)]" : "text-rose-500";
  return <span className={`text-xs ${color}`}>{trend === "up" ? "▲" : "▼"}</span>;
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
} as const;
