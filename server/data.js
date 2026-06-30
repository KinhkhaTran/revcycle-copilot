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
};

// Headline KPIs with benchmark + best-in-class context so the agent can frame them.
export const KPIS = [
  { id: "clean_claim_rate", label: "Clean claim rate", value: 92.9, unit: "%", trend: "up", benchmark: 95, bestInClass: 98, goodDirection: "up", stage: "back" },
  { id: "denial_rate", label: "Initial denial rate", value: 7.9, unit: "%", trend: "down", benchmark: 8, bestInClass: 3, goodDirection: "down", stage: "back" },
  { id: "days_in_ar", label: "Days in A/R", value: 37, unit: "days", trend: "down", benchmark: 40, bestInClass: 30, goodDirection: "down", stage: "back" },
  { id: "net_collection_rate", label: "Net collection rate", value: 96.1, unit: "%", trend: "up", benchmark: 96, bestInClass: 99, goodDirection: "up", stage: "back" },
  { id: "elig_auto_verify", label: "Eligibility auto-verify", value: 79, unit: "%", trend: "up", benchmark: 80, bestInClass: 92, goodDirection: "up", stage: "front" },
  { id: "pa_turnaround", label: "Prior-auth turnaround", value: 13, unit: "hrs", trend: "down", benchmark: 24, bestInClass: 4, goodDirection: "down", stage: "front" },
  { id: "pos_collections", label: "Point-of-service collections", value: 412000, unit: "$/mo", trend: "up", benchmark: 480000, bestInClass: 640000, goodDirection: "up", stage: "front" },
  { id: "reg_accuracy", label: "Registration accuracy", value: 94.2, unit: "%", trend: "up", benchmark: 97, bestInClass: 99, goodDirection: "up", stage: "front" },
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
