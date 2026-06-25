// Shared types for cards (mirrors the viz specs the backend emits) and chat.

export type Card =
  | { type: "stat"; title: string; subtitle?: string; stats: StatItem[] }
  | { type: "bar"; title: string; subtitle?: string; xKey: string; series: Series[]; data: any[] }
  | { type: "line"; title: string; subtitle?: string; unit?: string; data: { week: string; value: number }[] }
  | { type: "donut"; title: string; subtitle?: string; data: { name: string; value: number }[] }
  | { type: "table"; title: string; subtitle?: string; columns: Column[]; rows: any[] }
  | { type: "alerts"; title: string; alerts: Alert[] };

export interface StatItem {
  label: string;
  value: string;
  benchmark?: string;
  trend?: "up" | "down" | "flat";
  good?: boolean;
  stage?: "front" | "mid" | "back";
}
export interface Series { key: string; label: string }
export interface Column { key: string; label: string; format?: "pct" }
export interface Alert { severity: "high" | "medium" | "low"; title: string; detail: string; stage?: string }

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  cards?: Card[];
  tools?: string[];
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
}
