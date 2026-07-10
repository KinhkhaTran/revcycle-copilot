// Shared types for cards (mirrors the viz specs the backend emits) and chat.

export type Card = (
  | { type: "stat"; title: string; subtitle?: string; stats: StatItem[] }
  | { type: "bar"; title: string; subtitle?: string; xKey: string; series: Series[]; data: any[] }
  | { type: "line"; title: string; subtitle?: string; unit?: string; data: { week: string; value: number }[] }
  | { type: "donut"; title: string; subtitle?: string; data: { name: string; value: number }[] }
  | { type: "table"; title: string; subtitle?: string; columns: Column[]; rows: any[] }
  | { type: "alerts"; title: string; alerts: Alert[] }
  | { type: "funnel"; title: string; subtitle?: string; steps: FunnelStep[] }
  | { type: "impact"; title: string; subtitle?: string; current: number; target: number; ceiling: number; unit: string; monthlyDollars: number; annualDollars: number; denialsPrevented: number }
  | { type: "claim"; title: string; claim: Claim & { carcMeaning?: string } }
) & {
  /** Stable id the model references with a [[chart:id]] marker to place this card inline. */
  chartId?: string;
};

export interface StatItem {
  label: string;
  value: string;
  benchmark?: string;
  trend?: "up" | "down" | "flat";
  good?: boolean;
  stage?: "front" | "mid" | "back";
}
export interface Series { key: string; label: string }
export interface Column {
  key: string;
  label: string;
  format?: "pct" | "prod" | "queue" | "money" | "deadline" | "heat_low" | "heat_high";
}
export interface Alert { severity: "high" | "medium" | "low"; title: string; detail: string; stage?: string }
export interface FunnelStep { stage: string; count: number; note?: string }

export interface Claim {
  id: string;
  patient: string;
  dos: string;
  payer: string;
  service: string;
  amount: number;
  carc: string;
  reason: string;
  rootCause: string;
  stage: "front" | "mid" | "back";
  ageDays: number;
  deadlineDays: number;
  status: "new" | "in_progress" | "appealed";
  assignedTo: string;
}

export interface ToolStep { name: string; done: boolean }

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  tools?: ToolStep[];
  /** Parsed from the model's trailing [[suggest: a | b | c]] line. */
  suggestions?: string[];
  /** Sent to the model but not rendered — used to seed the proactive briefing. */
  hidden?: boolean;
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "flat";
  benchmark: number;
  bestInClass: number;
  goodDirection: "up" | "down";
  stage: "front" | "mid" | "back";
  spark?: number[];
}

export interface Overview {
  org: { name: string; type: string; asOf: string; monthlyClaimVolume: number; monthlyNetRevenue: number };
  kpis: Kpi[];
  alerts: Alert[];
  funnel: FunnelStep[];
  financials: { daysInAR: number; netCollectionRatePct: number; grossCollectionRatePct: number; cashCollectedMTD: number; cashGoalMTD: number; arOver90DaysPct: number; costToCollectPct: number };
  hasKey: boolean;
}
