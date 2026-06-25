// Tool definitions (JSON schemas Claude sees) + executors over the synthetic data.
//
// Each executor returns { forModel, card }:
//   - forModel: the data handed back to Claude as the tool_result (it reasons on this)
//   - card:     a viz spec streamed to the UI so the answer renders as generative cards
//
// Card types the frontend knows how to render: stat | bar | line | donut | table | alerts

import {
  ORG, TRENDS, KPIS, ELIGIBILITY, PRIOR_AUTH, REGISTRATION,
  CODING, DENIALS, FINANCIALS, STAFF, TEAMS, ALERTS,
} from "./data.js";

export const TOOLS = [
  {
    name: "get_kpi_overview",
    description:
      "Headline revenue-cycle KPIs across the whole cycle (front, mid, back) with industry benchmark and best-in-class context. Call this for broad 'how are we doing' questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_eligibility_stats",
    description:
      "FRONT-END. Eligibility verification performance: auto-verify rate, manual touch volume, failure reasons, and the revenue at risk from eligibility-driven denials. Use for eligibility, coverage, or 'why are claims failing upstream' questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_prior_auth_stats",
    description:
      "FRONT-END. Prior authorization performance: turnaround time, approval/denial rates, automation share, and breakdown by payer or service line. Use for any prior-auth / pre-cert question.",
    input_schema: {
      type: "object",
      properties: {
        payer: {
          type: "string",
          description: "Optional payer name to focus on (e.g. 'Cigna', 'UnitedHealthcare').",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_registration_quality",
    description:
      "FRONT-END. Patient access / registration quality: registration accuracy, demographic error rate, insurance discovery, and point-of-service collections. Use for registration, front-desk, or POS-collections questions.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_coding_productivity",
    description:
      "MID-CYCLE. Medical coding productivity: charts/coder/day, coding accuracy, backlog, DNFB, and the top documentation/coding issues that drive denials.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_denials",
    description:
      "BACK-END + root cause. Denial performance broken down by root-cause category or by payer. Includes appeal rate, overturn rate, and dollars recovered vs. written off. Use for any denial question.",
    input_schema: {
      type: "object",
      properties: {
        group_by: {
          type: "string",
          enum: ["category", "payer"],
          description: "How to break down denials. 'category' shows root cause (best for 'why'); 'payer' shows by insurer.",
        },
      },
      required: ["group_by"],
      additionalProperties: false,
    },
  },
  {
    name: "get_staff_productivity",
    description:
      "Team productivity roster: per-person throughput vs. target, productivity %, queue depth, and accuracy. Use for 'how is my team doing', 'who is behind', or staffing questions. Optionally filter to one team.",
    input_schema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          enum: TEAMS,
          description: "Optional team to filter to.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_trend",
    description:
      "Weekly trend (last 13 weeks) for a single strategic metric. Use when the user asks about direction over time ('is X improving', 'trend', 'over the quarter').",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: [
            "eligibilityAutoVerifyRate",
            "priorAuthTurnaroundHrs",
            "cleanClaimRate",
            "denialRate",
            "daysInAR",
            "codingBacklog",
          ],
          description: "Which metric to trend.",
        },
      },
      required: ["metric"],
      additionalProperties: false,
    },
  },
  {
    name: "get_financial_summary",
    description:
      "BACK-END. Cash and A/R health: days in A/R, net & gross collection rate, cash collected vs. goal, A/R over 90 days, cost to collect.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_alerts",
    description:
      "Proactive 'what is bleeding money this week' alerts the system has flagged across the cycle, with severity. Call this when the user asks what to focus on, what's wrong, or for a proactive summary.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const METRIC_META = {
  eligibilityAutoVerifyRate: { label: "Eligibility auto-verify rate", unit: "%", goodDirection: "up" },
  priorAuthTurnaroundHrs: { label: "Prior-auth turnaround", unit: "hrs", goodDirection: "down" },
  cleanClaimRate: { label: "Clean claim rate", unit: "%", goodDirection: "up" },
  denialRate: { label: "Initial denial rate", unit: "%", goodDirection: "down" },
  daysInAR: { label: "Days in A/R", unit: "days", goodDirection: "down" },
  codingBacklog: { label: "Coding backlog", unit: "charts", goodDirection: "down" },
};

export function executeTool(name, input = {}) {
  switch (name) {
    case "get_kpi_overview": {
      return {
        forModel: { org: ORG, kpis: KPIS },
        card: {
          type: "stat",
          title: "Revenue-cycle KPI overview",
          subtitle: `${ORG.name} · as of ${ORG.asOf}`,
          stats: KPIS.map((k) => ({
            label: k.label,
            value: formatValue(k.value, k.unit),
            benchmark: `Benchmark ${formatValue(k.benchmark, k.unit)}`,
            trend: k.trend,
            good: isGood(k),
            stage: k.stage,
          })),
        },
      };
    }

    case "get_eligibility_stats": {
      return {
        forModel: ELIGIBILITY,
        card: {
          type: "donut",
          title: "Eligibility verification — failure reasons",
          subtitle: `${ELIGIBILITY.autoVerifiedPct}% auto-verified · ~$${(ELIGIBILITY.estRevenueAtRiskMonthly / 1e6).toFixed(2)}M/mo at risk`,
          data: ELIGIBILITY.topFailureReasons.map((r) => ({ name: r.reason, value: r.share })),
        },
      };
    }

    case "get_registration_quality": {
      return {
        forModel: REGISTRATION,
        card: {
          type: "bar",
          title: "Registration — top error types",
          subtitle: `Accuracy ${REGISTRATION.accuracyPct}% · POS collections $${(REGISTRATION.posCollectionsMonthly / 1e3).toFixed(0)}K/mo`,
          xKey: "type",
          series: [{ key: "share", label: "% of errors" }],
          data: REGISTRATION.topErrorTypes,
        },
      };
    }

    case "get_prior_auth_stats": {
      const payer = input.payer
        ? PRIOR_AUTH.byPayer.find((p) => p.payer.toLowerCase().includes(String(input.payer).toLowerCase()))
        : null;
      return {
        forModel: payer ? { focus: payer, overall: { avgTurnaroundHrs: PRIOR_AUTH.avgTurnaroundHrs, approvedPct: PRIOR_AUTH.approvedPct } } : PRIOR_AUTH,
        card: {
          type: "bar",
          title: payer ? `Prior auth — ${payer.payer}` : "Prior auth turnaround by payer",
          subtitle: `Book-of-business avg ${PRIOR_AUTH.avgTurnaroundHrs} hrs · ${PRIOR_AUTH.autoSubmittedPct}% auto-submitted`,
          xKey: "payer",
          series: [{ key: "turnaroundHrs", label: "Turnaround (hrs)" }],
          data: PRIOR_AUTH.byPayer,
        },
      };
    }

    case "get_coding_productivity": {
      return {
        forModel: CODING,
        card: {
          type: "bar",
          title: "Coding — top denial-driving issues",
          subtitle: `${CODING.chartsPerCoderPerDay}/${CODING.targetChartsPerCoderPerDay} charts/coder/day · ${CODING.codingAccuracyPct}% accuracy · backlog ${CODING.backlogCharts}`,
          xKey: "issue",
          series: [{ key: "share", label: "% of coding denials" }],
          data: CODING.topDenialDrivingCodes,
        },
      };
    }

    case "get_denials": {
      const groupBy = input.group_by === "payer" ? "payer" : "category";
      if (groupBy === "payer") {
        return {
          forModel: { summary: denialSummary(), byPayer: DENIALS.byPayer },
          card: {
            type: "bar",
            title: "Denial rate by payer",
            subtitle: `Overall ${DENIALS.denialRatePct}% · appeal overturn ${DENIALS.appealOverturnPct}%`,
            xKey: "payer",
            series: [{ key: "denialRatePct", label: "Denial rate %" }],
            data: DENIALS.byPayer,
          },
        };
      }
      return {
        forModel: { summary: denialSummary(), byCategory: DENIALS.byCategory },
        card: {
          type: "donut",
          title: "Denials by root cause",
          subtitle: `${formatValue(DENIALS.monthlyDenials, "")} denials/mo · 55% originate in the front-end`,
          data: DENIALS.byCategory.map((c) => ({ name: c.category, value: c.share })),
        },
      };
    }

    case "get_staff_productivity": {
      const roster = input.team ? STAFF.filter((s) => s.team === input.team) : STAFF;
      return {
        forModel: { team: input.team || "All teams", roster },
        card: {
          type: "table",
          title: input.team ? `Team productivity — ${input.team}` : "Team productivity",
          subtitle: "Throughput vs. target, queue depth, accuracy",
          columns: [
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "productivityPct", label: "Prod %", format: "pct" },
            { key: "throughputPerDay", label: "Per day" },
            { key: "target", label: "Target" },
            { key: "queue", label: "Queue" },
            { key: "accuracyPct", label: "Accuracy", format: "pct" },
          ],
          rows: roster,
        },
      };
    }

    case "get_trend": {
      const metric = input.metric;
      const meta = METRIC_META[metric] || { label: metric, unit: "", goodDirection: "up" };
      const values = TRENDS[metric] || [];
      return {
        forModel: {
          metric: meta.label,
          unit: meta.unit,
          goodDirection: meta.goodDirection,
          weeks: TRENDS.weeks,
          values,
          first: values[0],
          last: values[values.length - 1],
        },
        card: {
          type: "line",
          title: `${meta.label} — 13-week trend`,
          subtitle: `${meta.label}: ${values[0]}${meta.unit} → ${values[values.length - 1]}${meta.unit}`,
          unit: meta.unit,
          data: TRENDS.weeks.map((w, i) => ({ week: w, value: values[i] })),
        },
      };
    }

    case "get_financial_summary": {
      return {
        forModel: FINANCIALS,
        card: {
          type: "stat",
          title: "Cash & A/R health",
          subtitle: `Cash MTD $${(FINANCIALS.cashCollectedMTD / 1e6).toFixed(1)}M of $${(FINANCIALS.cashGoalMTD / 1e6).toFixed(1)}M goal`,
          stats: [
            { label: "Days in A/R", value: `${FINANCIALS.daysInAR}`, benchmark: "Benchmark 40", trend: "down", good: true },
            { label: "Net collection rate", value: `${FINANCIALS.netCollectionRatePct}%`, benchmark: "Benchmark 96%", trend: "up", good: true },
            { label: "A/R over 90 days", value: `${FINANCIALS.arOver90DaysPct}%`, benchmark: "Target <15%", trend: "flat", good: false },
            { label: "Cost to collect", value: `${FINANCIALS.costToCollectPct}%`, benchmark: "Benchmark 3.5%", trend: "down", good: true },
          ],
        },
      };
    }

    case "get_alerts": {
      return {
        forModel: { alerts: ALERTS },
        card: { type: "alerts", title: "What's bleeding money right now", alerts: ALERTS },
      };
    }

    default:
      return { forModel: { error: `Unknown tool: ${name}` }, card: null };
  }
}

function denialSummary() {
  return {
    monthlyDenials: DENIALS.monthlyDenials,
    denialRatePct: DENIALS.denialRatePct,
    appealRatePct: DENIALS.appealRatePct,
    appealOverturnPct: DENIALS.appealOverturnPct,
    avgDaysToResolve: DENIALS.avgDaysToResolve,
    recoveredMonthly: DENIALS.recoveredMonthly,
    writeOffMonthly: DENIALS.writeOffMonthly,
  };
}

function isGood(k) {
  return k.goodDirection === "up" ? k.value >= k.benchmark : k.value <= k.benchmark;
}

function formatValue(v, unit) {
  if (unit === "$/mo" || unit === "$") {
    return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`;
  }
  if (unit === "") return v.toLocaleString();
  return `${v}${unit === "%" ? "%" : unit === "days" ? " days" : unit === "hrs" ? " hrs" : ` ${unit}`}`;
}
