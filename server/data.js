// ─────────────────────────────────────────────────────────────────────────────
// Synthetic revenue-cycle dataset for "Allina Health", a fictional
// mid-size ambulatory provider group serviced by Optum RCM.
//
// All numbers are invented but tuned to realistic 2026 industry benchmarks so the
// agent's answers feel credible in a demo. NO real PHI. The dataset is deliberately
// weighted toward the FRONT of the revenue cycle (eligibility, prior auth,
// registration) — that's where denials are born, and it's the strategic story.
// ─────────────────────────────────────────────────────────────────────────────

export const ORG = {
  name: "Allina Health",
  type: "Ambulatory provider group (42 clinics)",
  asOf: "2026-06-22",
  monthlyClaimVolume: 128400,
  monthlyNetRevenue: 38200000,
};

// 13 weeks of trend data (oldest → newest). Key strategic metrics.
const WEEKS = [
  "W14", "W15", "W16", "W17", "W18", "W19",
  "W20", "W21", "W22", "W23", "W24", "W25", "W26",
];

export const TRENDS = {
  weeks: WEEKS,
  // Front-end: % of eligibility checks auto-verified without staff touch.
  eligibilityAutoVerifyRate: [71, 72, 70, 73, 74, 74, 75, 76, 75, 77, 78, 78, 79],
  // Front-end: average prior-auth turnaround in hours.
  priorAuthTurnaroundHrs: [22, 21, 23, 20, 19, 18, 17, 16, 16, 15, 14, 13.5, 13],
  // Back-end: clean claim rate (first-pass acceptance), %.
  cleanClaimRate: [89.1, 88.4, 89.6, 90.2, 90.0, 90.8, 91.1, 91.4, 91.0, 91.9, 92.3, 92.6, 92.9],
  // Back-end: initial denial rate, %.
  denialRate: [11.4, 11.9, 11.2, 10.6, 10.8, 10.1, 9.7, 9.4, 9.6, 8.9, 8.5, 8.2, 7.9],
  // Back-end: days in A/R.
  daysInAR: [44, 45, 44, 43, 43, 42, 41, 41, 40, 39, 39, 38, 37],
  // Mid: coding backlog (charts in queue).
  codingBacklog: [1820, 1910, 1760, 1680, 1640, 1550, 1490, 1530, 1420, 1360, 1300, 1280, 1240],
  // Front-end: point-of-service collections, $K/mo run-rate.
  posCollections: [352, 348, 361, 370, 366, 379, 384, 391, 388, 397, 402, 408, 412],
  // Back-end: net collection rate, %.
  netCollectionRate: [94.8, 94.9, 95.0, 95.2, 95.1, 95.4, 95.5, 95.6, 95.5, 95.8, 95.9, 96.0, 96.1],
};

// Headline KPIs with benchmark + best-in-class context so the agent can frame
// them, plus a 13-week sparkline for the dashboard tiles.
export const KPIS = [
  { id: "clean_claim_rate", label: "Clean claim rate", value: 92.9, unit: "%", trend: "up", benchmark: 95, bestInClass: 98, goodDirection: "up", stage: "back", spark: TRENDS.cleanClaimRate },
  { id: "denial_rate", label: "Initial denial rate", value: 7.9, unit: "%", trend: "down", benchmark: 8, bestInClass: 3, goodDirection: "down", stage: "back", spark: TRENDS.denialRate },
  { id: "days_in_ar", label: "Days in A/R", value: 37, unit: "days", trend: "down", benchmark: 40, bestInClass: 30, goodDirection: "down", stage: "back", spark: TRENDS.daysInAR },
  { id: "net_collection_rate", label: "Net collection rate", value: 96.1, unit: "%", trend: "up", benchmark: 96, bestInClass: 99, goodDirection: "up", stage: "back", spark: TRENDS.netCollectionRate },
  { id: "elig_auto_verify", label: "Eligibility auto-verify", value: 79, unit: "%", trend: "up", benchmark: 80, bestInClass: 92, goodDirection: "up", stage: "front", spark: TRENDS.eligibilityAutoVerifyRate },
  { id: "pa_turnaround", label: "Prior-auth turnaround", value: 13, unit: "hrs", trend: "down", benchmark: 24, bestInClass: 4, goodDirection: "down", stage: "front", spark: TRENDS.priorAuthTurnaroundHrs },
  { id: "pos_collections", label: "Point-of-service collections", value: 412000, unit: "$/mo", trend: "up", benchmark: 480000, bestInClass: 640000, goodDirection: "up", stage: "front", spark: TRENDS.posCollections },
  { id: "reg_accuracy", label: "Registration accuracy", value: 94.2, unit: "%", trend: "up", benchmark: 97, bestInClass: 99, goodDirection: "up", stage: "front", spark: [92.1, 92.4, 92.2, 92.8, 93.0, 93.1, 93.4, 93.6, 93.5, 93.8, 94.0, 94.1, 94.2] },
  // Mid-cycle: clinical documentation, coding & charge capture.
  { id: "coding_accuracy", label: "Coding accuracy", value: 96.4, unit: "%", trend: "up", benchmark: 95, bestInClass: 98, goodDirection: "up", stage: "mid", spark: [95.2, 95.1, 95.4, 95.5, 95.6, 95.7, 95.9, 96.0, 95.9, 96.1, 96.2, 96.3, 96.4] },
  { id: "charge_lag", label: "Charge lag", value: 2.4, unit: "days", trend: "down", benchmark: 3, bestInClass: 1.5, goodDirection: "down", stage: "mid", spark: [3.4, 3.3, 3.4, 3.2, 3.1, 3.0, 2.9, 2.8, 2.8, 2.7, 2.6, 2.5, 2.4] },
  { id: "dnfb_days", label: "DNFB days", value: 5.1, unit: "days", trend: "down", benchmark: 4, bestInClass: 2, goodDirection: "down", stage: "mid", spark: [6.4, 6.2, 6.3, 6.0, 5.9, 5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1] },
  { id: "cdi_response", label: "CDI query response", value: 88, unit: "%", trend: "up", benchmark: 90, bestInClass: 95, goodDirection: "up", stage: "mid", spark: [83, 84, 83, 85, 85, 86, 86, 87, 86, 87, 88, 88, 88] },
];

// ── FRONT-END (50%) ──────────────────────────────────────────────────────────

export const ELIGIBILITY = {
  monthlyChecks: 131200,
  autoVerifiedPct: 79,
  manualPct: 21,
  failedFirstAttemptPct: 6.8,
  avgManualCheckMinutes: 7.5,
  // Eligibility/registration is the single biggest denial root cause upstream.
  denialsCausedMonthly: 3120,
  estRevenueAtRiskMonthly: 1840000,
  topFailureReasons: [
    { reason: "Coverage termed / inactive on date of service", share: 34 },
    { reason: "Plan not found / wrong payer selected", share: 23 },
    { reason: "Member ID mismatch", share: 18 },
    { reason: "Missing secondary coverage (COB)", share: 14 },
    { reason: "Subscriber vs. dependent mismatch", share: 11 },
  ],
};

export const PRIOR_AUTH = {
  monthlyRequests: 18600,
  avgTurnaroundHrs: 13,
  expeditedSharePct: 22,
  pending: 1340,
  approvedPct: 81,
  deniedPct: 9,
  autoSubmittedPct: 47, // share submitted via payer portal automation vs. manual
  // PA failures that became claim denials downstream.
  paRelatedDenialsMonthly: 1980,
  byPayer: [
    { payer: "UnitedHealthcare", requests: 6200, turnaroundHrs: 11, approvedPct: 84, deniedPct: 7 },
    { payer: "Aetna", requests: 3100, turnaroundHrs: 14, approvedPct: 80, deniedPct: 10 },
    { payer: "Cigna", requests: 2400, turnaroundHrs: 16, approvedPct: 78, deniedPct: 11 },
    { payer: "BCBS", requests: 3500, turnaroundHrs: 15, approvedPct: 82, deniedPct: 8 },
    { payer: "Medicare Advantage", requests: 2100, turnaroundHrs: 12, approvedPct: 85, deniedPct: 6 },
    { payer: "Medicaid MCO", requests: 1300, turnaroundHrs: 18, approvedPct: 74, deniedPct: 14 },
  ],
  topServiceLines: [
    { service: "Advanced imaging (MRI/CT/PET)", share: 31 },
    { service: "Specialty infusion / injectables", share: 26 },
    { service: "Outpatient surgery", share: 19 },
    { service: "Physical & occupational therapy", share: 14 },
    { service: "Sleep studies", share: 10 },
  ],
};

export const REGISTRATION = {
  monthlyRegistrations: 134500,
  accuracyPct: 94.2,
  demographicErrorRatePct: 5.8,
  insuranceDiscoveryHitRatePct: 38, // self-pay accounts found to have coverage
  posCollectionsMonthly: 412000,
  posCollectionRatePct: 41, // % of point-of-service amounts actually collected
  estimatedPatientLiabilityShownPct: 67,
  topErrorTypes: [
    { type: "Wrong insurance plan selected", share: 29 },
    { type: "Misspelled / transposed member ID", share: 24 },
    { type: "Outdated address / phone", share: 19 },
    { type: "Missing guarantor info", share: 16 },
    { type: "Date-of-birth mismatch", share: 12 },
  ],
};

// ── MID-CYCLE (25%) ──────────────────────────────────────────────────────────

export const CODING = {
  codersFTE: 34,
  chartsPerCoderPerDay: 28,
  targetChartsPerCoderPerDay: 32,
  codingAccuracyPct: 95.4,
  backlogCharts: 1240,
  dnfbDays: 4.6, // discharged not final billed
  autosuggestAcceptancePct: 58, // share of AI-suggested codes coders accept
  topDenialDrivingCodes: [
    { issue: "Medical necessity not supported by documentation", share: 33 },
    { issue: "Missing/invalid modifier", share: 21 },
    { issue: "Unbundling / NCCI edit", share: 17 },
    { issue: "Diagnosis not to highest specificity", share: 16 },
    { issue: "Place-of-service mismatch", share: 13 },
  ],
};

// ── BACK-END (25%) ───────────────────────────────────────────────────────────

export const DENIALS = {
  monthlyDenials: 10140,
  denialRatePct: 7.9,
  appealRatePct: 61,
  appealOverturnPct: 47,
  avgDaysToResolve: 19,
  recoveredMonthly: 2640000,
  writeOffMonthly: 1380000,
  byCategory: [
    { category: "Eligibility / registration", share: 31, stage: "front", trend: "up" },
    { category: "Prior auth / referral", share: 24, stage: "front", trend: "down" },
    { category: "Coding / medical necessity", share: 19, stage: "mid", trend: "flat" },
    { category: "Missing / invalid info", share: 12, stage: "back", trend: "down" },
    { category: "Untimely filing", share: 8, stage: "back", trend: "down" },
    { category: "Duplicate claim", share: 6, stage: "back", trend: "flat" },
  ],
  byPayer: [
    { payer: "UnitedHealthcare", denialRatePct: 6.8, volume: 2980 },
    { payer: "Aetna", denialRatePct: 8.4, volume: 1610 },
    { payer: "Cigna", denialRatePct: 9.6, volume: 1340 },
    { payer: "BCBS", denialRatePct: 7.5, volume: 1880 },
    { payer: "Medicare Advantage", denialRatePct: 6.1, volume: 1490 },
    { payer: "Medicaid MCO", denialRatePct: 12.3, volume: 840 },
  ],
};

export const FINANCIALS = {
  daysInAR: 37,
  netCollectionRatePct: 96.1,
  grossCollectionRatePct: 41.8,
  cashCollectedMTD: 28900000,
  cashGoalMTD: 31000000,
  arOver90DaysPct: 18.4,
  costToCollectPct: 3.2,
};

// One unified per-payer scorecard so payer conversations don't need 3 tools.
export const PAYER_SCORECARD = [
  { payer: "UnitedHealthcare", denialRatePct: 6.8, paTurnaroundHrs: 11, avgDaysToPay: 24, overturnPct: 52, netCollectionPct: 97.2, monthlyBilled: 11100000 },
  { payer: "Aetna", denialRatePct: 8.4, paTurnaroundHrs: 14, avgDaysToPay: 31, overturnPct: 46, netCollectionPct: 95.8, monthlyBilled: 5500000 },
  { payer: "Cigna", denialRatePct: 9.6, paTurnaroundHrs: 16, avgDaysToPay: 35, overturnPct: 41, netCollectionPct: 94.9, monthlyBilled: 4200000 },
  { payer: "BCBS", denialRatePct: 7.5, paTurnaroundHrs: 15, avgDaysToPay: 28, overturnPct: 49, netCollectionPct: 96.3, monthlyBilled: 6700000 },
  { payer: "Medicare Advantage", denialRatePct: 6.1, paTurnaroundHrs: 12, avgDaysToPay: 21, overturnPct: 55, netCollectionPct: 97.6, monthlyBilled: 5000000 },
  { payer: "Medicaid MCO", denialRatePct: 12.3, paTurnaroundHrs: 18, avgDaysToPay: 41, overturnPct: 38, netCollectionPct: 92.4, monthlyBilled: 2500000 },
];

// The month's claim flow, front to back — the funnel the whole story hangs on.
export const FUNNEL = [
  { stage: "Claims submitted", count: 128400, note: "All payers, June" },
  { stage: "Passed first-pass edits", count: 119280, note: "92.9% clean claim rate" },
  { stage: "Denied on first pass", count: 10140, note: "7.9% initial denial rate" },
  { stage: "Appealed", count: 6190, note: "61% of denials worked" },
  { stage: "Overturned & paid", count: 2910, note: "47% overturn rate · $2.64M recovered" },
];

// ── DENIED-CLAIM WORKLIST ────────────────────────────────────────────────────
// A working queue of individual denied claims (synthetic — initials only, no PHI).
// This is what the agent drills into and drafts appeals from.

export const CLAIMS = [
  { id: "CLM-20461", patient: "J.R.", dos: "2026-06-03", payer: "Cigna", service: "MRI lumbar spine", amount: 2840, carc: "CO-197", reason: "Precertification/authorization absent", rootCause: "Prior auth not obtained before service", stage: "front", ageDays: 19, deadlineDays: 71, status: "new", assignedTo: "Aisha Khan" },
  { id: "CLM-20488", patient: "M.T.", dos: "2026-06-05", payer: "UnitedHealthcare", service: "Office visit, level 4", amount: 310, carc: "CO-27", reason: "Expenses incurred after coverage terminated", rootCause: "Eligibility not re-verified — coverage termed 5/31", stage: "front", ageDays: 17, deadlineDays: 163, status: "new", assignedTo: "Luis Mendez" },
  { id: "CLM-20512", patient: "D.W.", dos: "2026-06-06", payer: "Medicaid MCO", service: "Physical therapy, 8 visits", amount: 1460, carc: "CO-197", reason: "Precertification/authorization absent", rootCause: "PA expired after visit 6 — not renewed", stage: "front", ageDays: 16, deadlineDays: 44, status: "in_progress", assignedTo: "Aisha Khan" },
  { id: "CLM-20535", patient: "S.K.", dos: "2026-06-08", payer: "Aetna", service: "Specialty infusion (biologic)", amount: 9120, carc: "CO-50", reason: "Non-covered: not deemed medically necessary", rootCause: "Documentation didn't support step-therapy failure", stage: "mid", ageDays: 14, deadlineDays: 166, status: "new", assignedTo: "Owen Park" },
  { id: "CLM-20549", patient: "A.B.", dos: "2026-06-09", payer: "BCBS", service: "Sleep study, in-lab", amount: 2150, carc: "CO-197", reason: "Precertification/authorization absent", rootCause: "Auth obtained for home study, in-lab performed", stage: "front", ageDays: 13, deadlineDays: 77, status: "new", assignedTo: "Luis Mendez" },
  { id: "CLM-20578", patient: "R.G.", dos: "2026-06-10", payer: "Cigna", service: "Outpatient knee arthroscopy", amount: 6480, carc: "CO-16", reason: "Claim lacks information (missing modifier)", rootCause: "Missing laterality modifier at coding", stage: "mid", ageDays: 12, deadlineDays: 78, status: "in_progress", assignedTo: "Owen Park" },
  { id: "CLM-20591", patient: "L.N.", dos: "2026-06-11", payer: "UnitedHealthcare", service: "CT abdomen w/ contrast", amount: 1890, carc: "CO-22", reason: "Care may be covered by another payer (COB)", rootCause: "Secondary coverage not captured at registration", stage: "front", ageDays: 11, deadlineDays: 169, status: "new", assignedTo: "Luis Mendez" },
  { id: "CLM-20604", patient: "P.H.", dos: "2026-06-12", payer: "Medicare Advantage", service: "Echocardiogram", amount: 720, carc: "CO-109", reason: "Claim not covered by this payer/contractor", rootCause: "Wrong plan selected — member switched MA plans in May", stage: "front", ageDays: 10, deadlineDays: 50, status: "new", assignedTo: "Aisha Khan" },
  { id: "CLM-20633", patient: "C.V.", dos: "2026-06-13", payer: "Aetna", service: "Office visit + labs", amount: 540, carc: "CO-140", reason: "Patient/insured member ID mismatch", rootCause: "Transposed member ID digits at registration", stage: "front", ageDays: 9, deadlineDays: 171, status: "new", assignedTo: "Luis Mendez" },
  { id: "CLM-20657", patient: "T.S.", dos: "2026-06-16", payer: "BCBS", service: "Occupational therapy eval", amount: 380, carc: "CO-29", reason: "Time limit for filing has expired", rootCause: "Claim held 94 days in coding backlog before submission", stage: "back", ageDays: 6, deadlineDays: 15, status: "new", assignedTo: "Owen Park" },
  { id: "CLM-20672", patient: "K.M.", dos: "2026-06-17", payer: "Cigna", service: "PET scan, oncology staging", amount: 4980, carc: "CO-50", reason: "Non-covered: not deemed medically necessary", rootCause: "Clinical notes missing prior conventional imaging", stage: "mid", ageDays: 5, deadlineDays: 85, status: "new", assignedTo: "Aisha Khan" },
  { id: "CLM-20694", patient: "E.D.", dos: "2026-06-19", payer: "Medicaid MCO", service: "Behavioral health, 4 sessions", amount: 620, carc: "CO-18", reason: "Duplicate claim/service", rootCause: "Resubmitted while original still in process", stage: "back", ageDays: 3, deadlineDays: 57, status: "in_progress", assignedTo: "Owen Park" },
];

// ── WHAT-IF LEVERS ───────────────────────────────────────────────────────────
// Simple linear impact models for the ROI simulator: dollars & denials recovered
// per point of improvement, with a credible ceiling.

export const LEVERS = {
  elig_auto_verify: {
    label: "Eligibility auto-verify rate", unit: "%", current: 79, ceiling: 92, goodDirection: "up",
    dollarsPerPoint: 140000, denialsPerPoint: 240,
    how: "Each point of auto-verification removes manual touches and catches termed/mismatched coverage before the visit.",
  },
  reg_accuracy: {
    label: "Registration accuracy", unit: "%", current: 94.2, ceiling: 99, goodDirection: "up",
    dollarsPerPoint: 124000, denialsPerPoint: 205,
    how: "Cleaner demographics/plan selection at the front desk prevents CO-140/CO-22 style denials downstream.",
  },
  pa_auto_submit: {
    label: "Prior-auth auto-submission share", unit: "%", current: 47, ceiling: 80, goodDirection: "up",
    dollarsPerPoint: 30000, denialsPerPoint: 37,
    how: "Portal-automated PA submissions cut turnaround and expiry-related CO-197 denials.",
  },
  clean_claim_rate: {
    label: "Clean claim rate", unit: "%", current: 92.9, ceiling: 98, goodDirection: "up",
    dollarsPerPoint: 232000, denialsPerPoint: 460,
    how: "First-pass yield is the compound of all upstream fixes — each point avoids rework and denial write-offs.",
  },
  appeal_rate: {
    label: "Appeal rate (denials worked)", unit: "%", current: 61, ceiling: 85, goodDirection: "up",
    dollarsPerPoint: 50000, denialsPerPoint: 0,
    how: "Working more of the denial queue recovers dollars at the current 47% overturn rate.",
  },
  pos_collection_rate: {
    label: "Point-of-service collection rate", unit: "%", current: 41, ceiling: 65, goodDirection: "up",
    dollarsPerPoint: 10000, denialsPerPoint: 0,
    how: "Collecting patient responsibility at check-in avoids statement cycles and bad debt.",
  },
};

// ── STAFF / PRODUCTIVITY ─────────────────────────────────────────────────────
// The manager's team. Productivity is the core "how is my team doing" question.

export const STAFF = [
  { name: "Maria Alvarez", team: "Eligibility & Auth", role: "Eligibility Specialist", productivityPct: 112, throughputPerDay: 168, target: 150, queue: 22, accuracyPct: 97.1, stage: "front" },
  { name: "Darnell Brooks", team: "Eligibility & Auth", role: "Prior Auth Coordinator", productivityPct: 104, throughputPerDay: 58, target: 56, queue: 41, accuracyPct: 95.8, stage: "front" },
  { name: "Priya Nair", team: "Eligibility & Auth", role: "Prior Auth Coordinator", productivityPct: 88, throughputPerDay: 49, target: 56, queue: 73, accuracyPct: 96.4, stage: "front" },
  { name: "Tony Russo", team: "Patient Access", role: "Registration Rep", productivityPct: 96, throughputPerDay: 240, target: 250, queue: 0, accuracyPct: 92.6, stage: "front" },
  { name: "Grace Liu", team: "Patient Access", role: "Registration Rep", productivityPct: 119, throughputPerDay: 298, target: 250, queue: 0, accuracyPct: 95.9, stage: "front" },
  { name: "Sam Okafor", team: "Coding", role: "Inpatient Coder", productivityPct: 91, throughputPerDay: 26, target: 28, queue: 88, accuracyPct: 96.2, stage: "mid" },
  { name: "Beth Carter", team: "Coding", role: "Outpatient Coder", productivityPct: 103, throughputPerDay: 33, target: 32, queue: 35, accuracyPct: 95.1, stage: "mid" },
  { name: "Luis Mendez", team: "Denials & Appeals", role: "Denials Analyst", productivityPct: 107, throughputPerDay: 47, target: 44, queue: 51, accuracyPct: 94.4, stage: "back" },
  { name: "Aisha Khan", team: "Denials & Appeals", role: "Appeals Specialist", productivityPct: 84, throughputPerDay: 18, target: 22, queue: 96, accuracyPct: 93.7, stage: "back" },
  { name: "Owen Park", team: "Denials & Appeals", role: "Denials Analyst", productivityPct: 98, throughputPerDay: 43, target: 44, queue: 60, accuracyPct: 95.0, stage: "back" },
];

export const TEAMS = ["Eligibility & Auth", "Patient Access", "Coding", "Denials & Appeals"];

// A few "what's bleeding money" insights the agent can proactively surface.
export const ALERTS = [
  {
    severity: "high",
    title: "Eligibility-driven denials climbing",
    detail:
      "Eligibility/registration is now 31% of all denials (up from 27% a quarter ago), the single largest root cause. ~$1.84M/mo of revenue is at risk upstream.",
    stage: "front",
  },
  {
    severity: "high",
    title: "Timely-filing deadline at risk",
    detail:
      "CLM-20657 (BCBS, $380) has 15 days left to appeal a timely-filing denial caused by the coding backlog. 3 more claims cross the 30-day mark this month.",
    stage: "back",
  },
  {
    severity: "medium",
    title: "Cigna prior-auth turnaround lagging",
    detail:
      "Cigna PA turnaround is 16 hrs vs. a 13 hr book of business average, and Cigna also carries the highest payer denial rate (9.6%) outside Medicaid.",
    stage: "front",
  },
  {
    severity: "medium",
    title: "Appeals queue backing up",
    detail:
      "Aisha Khan's appeals queue is at 96 with productivity at 84%. Overturn rate is 47% — unworked appeals are leaving recoverable dollars on the table.",
    stage: "back",
  },
];
