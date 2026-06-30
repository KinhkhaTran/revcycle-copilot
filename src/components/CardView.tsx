import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Card } from "../types";

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
              title={`Explain ${s.label}`}
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
                  title={`Explain ${d.name}`}
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
                  onClick={() => ask(row.name ?? row[card.columns[0]?.key])}
                  title="Explain this row"
                  className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50"
                >
                  {card.columns.map((c) => {
                    const v = row[c.key];
                    const isProd = c.key === "productivityPct";
                    const isQueue = c.key === "queue";
                    return (
                      <td key={c.key} className="px-2 py-1.5">
                        {c.key === "name" ? (
                          <span className="font-medium text-slate-900">{v}</span>
                        ) : isProd ? (
                          <span className={`rounded px-1.5 py-0.5 font-semibold ${v >= 100 ? "bg-emerald-50 text-emerald-700" : v >= 90 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{v}%</span>
                        ) : isQueue ? (
                          <span className={v > 80 ? "font-semibold text-rose-600" : "text-slate-600"}>{v}</span>
                        ) : (
                          <span className="text-slate-600">{c.format === "pct" ? `${v}%` : v}</span>
                        )}
                      </td>
                    );
                  })}
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
                title={`Explain "${a.title}"`}
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
  }
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
