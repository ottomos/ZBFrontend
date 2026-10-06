export type CoverageSegment = 'VIP' | 'Institution' | 'Corporate' | 'Retail';
export type SourceChannel = 'Corporate' | 'Commercial';
export type ValueTier = 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Not Available';
export type LifecycleStage = 'Established' | 'Growing' | 'Declining' | 'Dormant' | 'Emerging' | 'New' | 'Not Available';
export type RiskStatus = 'Normal' | 'Watch' | 'At Risk' | 'Review' | 'Not Available';
export type ProfitabilityStatus = 'Profitable' | 'Marginal' | 'Loss Making' | 'Not Available';
export type DataState = 'Complete' | 'Reduced History' | 'Partial' | 'Stale';

export type NamedClient = {
  cif: string;
  name: string;
  source_channel: SourceChannel;
  coverage_segment: CoverageSegment;
  data_state: DataState;
  complete_months: number;
  value_tier: ValueTier;
  tier_score: number | null;
  lifecycle: LifecycleStage;
  risk: RiskStatus;
  profitability: ProfitabilityStatus;
  first_trade: string;
  last_trade: string;
  age_days: number;
  days_since_activity: number;
  t12_volume_usd: number | null;
  rolling_profitability_usd: number | null;
  active_months: number | null;
  monthly_pnl?: Array<number | null>;
};

export type ClientPeriodPerf = {
  cif: string;
  name: string;
  coverage_segment: CoverageSegment;
  may_pnl: number;
  may_volume: number;
  may_deals: number;
  may_yield_bps: number | null;
  jun_pnl: number;
  jun_volume: number;
  jun_deals: number;
  jun_yield_bps: number | null;
};

export type TierScorecard = {
  cif: string;
  t12_volume_usd: number | null;
  rolling_profitability_usd: number | null;
  active_months: number | null;
  volume_points: number | null;
  profitability_points: number | null;
  activity_points: number | null;
  score: number | null;
  calculated_tier: ValueTier;
  effective_tier: ValueTier;
  note: string;
};

export type Detection = {
  id: string;
  cif: string;
  client_name: string;
  coverage_segment: CoverageSegment;
  rule: string;
  rule_version: string;
  severity: 'High' | 'Medium' | 'Low';
  type: string;
  description: string;
  evidence_label: string;
  evidence_value: string;
  threshold_label: string;
  threshold_value: string;
  detected_date: string;
  status: 'Open' | 'Acknowledged' | 'Resolved';
  observation_only: boolean;
};

export type Transaction = {
  seq: number;
  txn_id: string;
  leg_id: string;
  trade_date: string;
  maturity_date: string;
  product: 'Spot' | 'Forward';
  direction: string;
  currency_pair: string;
  dealt_currency: string;
  gross_dealt: number;
  spot_rate: number;
  usd_amount: number;
  profit_usd: number;
  booking_status: string;
};

export const MONTHS = [
  'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025',
  'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026',
];

export const namedClients: NamedClient[] = [
  {
    cif: 'CIF-100184',
    name: 'Al Noor General Trading W.L.L.',
    source_channel: 'Corporate',
    coverage_segment: 'Corporate',
    data_state: 'Complete',
    complete_months: 12,
    value_tier: 'Platinum',
    tier_score: 90,
    lifecycle: 'Declining',
    risk: 'At Risk',
    profitability: 'Profitable',
    first_trade: '2018-02-14',
    last_trade: '2026-06-30',
    age_days: 3058,
    days_since_activity: 0,
    t12_volume_usd: 3920000,
    rolling_profitability_usd: 14760,
    active_months: 12,
    monthly_pnl: [900, 950, 980, 1100, 1050, 1200, 1150, 1250, 1300, 1400, 1500, 1980],
  },
  {
    cif: 'CIF-100392',
    name: 'Gulf Horizon Industrial Projects Company',
    source_channel: 'Corporate',
    coverage_segment: 'Corporate',
    data_state: 'Complete',
    complete_months: 12,
    value_tier: 'Platinum',
    tier_score: 70,
    lifecycle: 'Dormant',
    risk: 'At Risk',
    profitability: 'Profitable',
    first_trade: '2019-06-10',
    last_trade: '2026-03-12',
    age_days: 2577,
    days_since_activity: 110,
    t12_volume_usd: 2440000,
    rolling_profitability_usd: 7400,
    active_months: 9,
    monthly_pnl: [700, 750, 700, 850, 800, 900, 800, 900, 1000, 0, 0, 0],
  },
  {
    cif: 'CIF-100517',
    name: 'Pearl Coast Foodstuff and Logistics',
    source_channel: 'Commercial',
    coverage_segment: 'VIP',
    data_state: 'Stale',
    complete_months: 12,
    value_tier: 'Silver',
    tier_score: 45,
    lifecycle: 'Growing',
    risk: 'Normal',
    profitability: 'Profitable',
    first_trade: '2023-09-21',
    last_trade: '2026-06-30',
    age_days: 1013,
    days_since_activity: 0,
    t12_volume_usd: 590000,
    rolling_profitability_usd: 5900,
    active_months: 12,
    monthly_pnl: [400, 550, 560, 600, 590, 680, 750, 850, 1020, 1000, 1050, 1200],
  },
  {
    cif: 'CIF-100644',
    name: 'Kuwait Integrated Technical Services',
    source_channel: 'Corporate',
    coverage_segment: 'Corporate',
    data_state: 'Complete',
    complete_months: 12,
    value_tier: 'Gold',
    tier_score: 60,
    lifecycle: 'Declining',
    risk: 'At Risk',
    profitability: 'Profitable',
    first_trade: '2021-01-17',
    last_trade: '2026-06-30',
    age_days: 1990,
    days_since_activity: 0,
    t12_volume_usd: 1360000,
    rolling_profitability_usd: 8320,
    active_months: 12,
    monthly_pnl: [600, 650, 620, 700, 650, 700, 650, 700, 720, 820, 800, 710],
  },
  {
    cif: 'CIF-100731',
    name: 'Blue Dunes Consumer Holdings W.L.L.',
    source_channel: 'Commercial',
    coverage_segment: 'Corporate',
    data_state: 'Reduced History',
    complete_months: 8,
    value_tier: 'Not Available',
    tier_score: null,
    lifecycle: 'Emerging',
    risk: 'Not Available',
    profitability: 'Not Available',
    first_trade: '2025-11-01',
    last_trade: '2026-06-30',
    age_days: 241,
    days_since_activity: 0,
    t12_volume_usd: null,
    rolling_profitability_usd: null,
    active_months: 8,
    monthly_pnl: [null, null, null, null, 100, 120, 100, 150, 180, 220, 240, 300],
  },
  {
    cif: 'CIF-100856',
    name: 'National Marine Equipment and Contracting',
    source_channel: 'Corporate',
    coverage_segment: 'Institution',
    data_state: 'Complete',
    complete_months: 12,
    value_tier: 'Platinum',
    tier_score: 70,
    lifecycle: 'Established',
    risk: 'Normal',
    profitability: 'Profitable',
    first_trade: '2017-04-03',
    last_trade: '2026-06-30',
    age_days: 3375,
    days_since_activity: 0,
    t12_volume_usd: 1800000,
    rolling_profitability_usd: 11470,
    active_months: 12,
    monthly_pnl: [800, 850, 820, 900, 880, 950, 900, 1000, 1010, 1050, 1110, 1200],
  },
  {
    cif: 'CIF-100913',
    name: 'Eastern Gate Travel and Tourism',
    source_channel: 'Commercial',
    coverage_segment: 'VIP',
    data_state: 'Complete',
    complete_months: 12,
    value_tier: 'Bronze',
    tier_score: 30,
    lifecycle: 'Dormant',
    risk: 'Watch',
    profitability: 'Marginal',
    first_trade: '2024-07-15',
    last_trade: '2026-03-31',
    age_days: 715,
    days_since_activity: 91,
    t12_volume_usd: 210000,
    rolling_profitability_usd: 3370,
    active_months: 9,
    monthly_pnl: [300, 350, 320, 400, 380, 420, 350, 400, 450, 0, 0, 0],
  },
  {
    cif: 'CIF-101042',
    name: 'Crescent Medical Supplies and Services',
    source_channel: 'Commercial',
    coverage_segment: 'VIP',
    data_state: 'Partial',
    complete_months: 3,
    value_tier: 'Not Available',
    tier_score: null,
    lifecycle: 'New',
    risk: 'Not Available',
    profitability: 'Not Available',
    first_trade: '2026-04-05',
    last_trade: '2026-06-30',
    age_days: 86,
    days_since_activity: 0,
    t12_volume_usd: null,
    rolling_profitability_usd: null,
    active_months: 3,
    monthly_pnl: [null, null, null, null, null, null, null, null, null, 250, 520, 550],
  },
];

export const clientPeriodPerf: ClientPeriodPerf[] = [
  { cif: 'CIF-100184', name: 'Al Noor General Trading W.L.L.', coverage_segment: 'Corporate', may_pnl: 1500, may_volume: 205000, may_deals: 36, may_yield_bps: 73.2, jun_pnl: 1980, jun_volume: 184000, jun_deals: 38, jun_yield_bps: 107.6 },
  { cif: 'CIF-100392', name: 'Gulf Horizon Industrial Projects Co.', coverage_segment: 'Corporate', may_pnl: 0, may_volume: 0, may_deals: 0, may_yield_bps: null, jun_pnl: 0, jun_volume: 0, jun_deals: 0, jun_yield_bps: null },
  { cif: 'CIF-100644', name: 'Kuwait Integrated Technical Services', coverage_segment: 'Corporate', may_pnl: 800, may_volume: 60000, may_deals: 18, may_yield_bps: 133.3, jun_pnl: 710, jun_volume: 50000, jun_deals: 16, jun_yield_bps: 142.0 },
  { cif: 'CIF-100731', name: 'Blue Dunes Consumer Holdings W.L.L.', coverage_segment: 'Corporate', may_pnl: 240, may_volume: 60000, may_deals: 10, may_yield_bps: 40.0, jun_pnl: 300, jun_volume: 65000, jun_deals: 12, jun_yield_bps: 46.2 },
  { cif: 'CIF-100517', name: 'Pearl Coast Foodstuff and Logistics', coverage_segment: 'VIP', may_pnl: 1050, may_volume: 80000, may_deals: 22, may_yield_bps: 131.3, jun_pnl: 1200, jun_volume: 90000, jun_deals: 25, jun_yield_bps: 133.3 },
  { cif: 'CIF-100913', name: 'Eastern Gate Travel and Tourism', coverage_segment: 'VIP', may_pnl: 0, may_volume: 0, may_deals: 0, may_yield_bps: null, jun_pnl: 0, jun_volume: 0, jun_deals: 0, jun_yield_bps: null },
  { cif: 'CIF-101042', name: 'Crescent Medical Supplies and Services', coverage_segment: 'VIP', may_pnl: 520, may_volume: 30000, may_deals: 7, may_yield_bps: 173.3, jun_pnl: 550, jun_volume: 35000, jun_deals: 8, jun_yield_bps: 157.1 },
  { cif: 'CIF-100856', name: 'National Marine Equipment & Contracting', coverage_segment: 'Institution', may_pnl: 1110, may_volume: 150000, may_deals: 2, may_yield_bps: 74.0, jun_pnl: 1200, jun_volume: 160000, jun_deals: 2, jun_yield_bps: 75.0 },
];

export const tierScorecards: TierScorecard[] = [
  { cif: 'CIF-100184', t12_volume_usd: 3920000, rolling_profitability_usd: 14760, active_months: 12, volume_points: 60, profitability_points: 20, activity_points: 10, score: 90, calculated_tier: 'Platinum', effective_tier: 'Platinum', note: 'Immediate downgrade from Diamond. Effective 1 Jul 2026.' },
  { cif: 'CIF-100392', t12_volume_usd: 2440000, rolling_profitability_usd: 7400, active_months: 9, volume_points: 50, profitability_points: 10, activity_points: 10, score: 70, calculated_tier: 'Platinum', effective_tier: 'Platinum', note: 'Stable; no pending tier change.' },
  { cif: 'CIF-100517', t12_volume_usd: 590000, rolling_profitability_usd: 5900, active_months: 12, volume_points: 25, profitability_points: 10, activity_points: 10, score: 45, calculated_tier: 'Silver', effective_tier: 'Silver', note: 'Stale — last successful refresh 2026-05-31. Values reflect last successful calculation.' },
  { cif: 'CIF-100644', t12_volume_usd: 1360000, rolling_profitability_usd: 8320, active_months: 12, volume_points: 40, profitability_points: 10, activity_points: 10, score: 60, calculated_tier: 'Gold', effective_tier: 'Gold', note: 'Stable; no pending tier change.' },
  { cif: 'CIF-100731', t12_volume_usd: null, rolling_profitability_usd: null, active_months: 8, volume_points: null, profitability_points: null, activity_points: null, score: null, calculated_tier: 'Not Available', effective_tier: 'Not Available', note: 'Input gate failed: only 8 Complete Months.' },
  { cif: 'CIF-100856', t12_volume_usd: 1800000, rolling_profitability_usd: 11470, active_months: 12, volume_points: 40, profitability_points: 20, activity_points: 10, score: 70, calculated_tier: 'Platinum', effective_tier: 'Platinum', note: 'Stable; no pending tier change.' },
  { cif: 'CIF-100913', t12_volume_usd: 210000, rolling_profitability_usd: 3370, active_months: 9, volume_points: 10, profitability_points: 10, activity_points: 10, score: 30, calculated_tier: 'Bronze', effective_tier: 'Bronze', note: 'Stable; no pending tier change.' },
  { cif: 'CIF-101042', t12_volume_usd: null, rolling_profitability_usd: null, active_months: 3, volume_points: null, profitability_points: null, activity_points: null, score: null, calculated_tier: 'Not Available', effective_tier: 'Not Available', note: 'Input gate failed: only 3 Complete Months.' },
];

export const detections: Detection[] = [
  { id: 'DET-100184-R001-20260630', cif: 'CIF-100184', client_name: 'Al Noor General Trading W.L.L.', coverage_segment: 'Corporate', rule: 'RULE-001', rule_version: 'v1.4', severity: 'High', type: 'Material Volume Decline', description: 'Latest-3 month avg USD 203,000 vs preceding-9 avg USD 367,889 — a 44.8% decline. Exceeds the 40% At Risk threshold.', evidence_label: 'Volume Decline', evidence_value: '−44.8%', threshold_label: 'At Risk threshold', threshold_value: '≥40%', detected_date: '2026-06-30', status: 'Open', observation_only: false },
  { id: 'DET-100392-R001-20260630', cif: 'CIF-100392', client_name: 'Gulf Horizon Industrial Projects Company', coverage_segment: 'Corporate', rule: 'RULE-001', rule_version: 'v1.4', severity: 'High', type: 'Material Volume Decline', description: 'Latest-3 month avg USD 0 vs preceding-9 avg USD 271,111 — a 100% decline. Client has been dormant since Mar 2026.', evidence_label: 'Volume Decline', evidence_value: '−100.0%', threshold_label: 'At Risk threshold', threshold_value: '≥40%', detected_date: '2026-06-30', status: 'Open', observation_only: false },
  { id: 'DET-100392-R002-20260630', cif: 'CIF-100392', client_name: 'Gulf Horizon Industrial Projects Company', coverage_segment: 'Corporate', rule: 'RULE-002', rule_version: 'v1.0', severity: 'High', type: 'High-Value Dormancy', description: '110 days since last activity. Dormancy threshold 90–179 days. Platinum-tier client with no booked eligible activity since 12 Mar 2026.', evidence_label: 'Days Since Activity', evidence_value: '110 days', threshold_label: 'Dormancy threshold', threshold_value: '90 days', detected_date: '2026-06-30', status: 'Open', observation_only: false },
  { id: 'DET-100644-R001-20260630', cif: 'CIF-100644', client_name: 'Kuwait Integrated Technical Services', coverage_segment: 'Corporate', rule: 'RULE-001', rule_version: 'v1.4', severity: 'High', type: 'Material Volume Decline', description: 'Latest-3 month avg USD 60,000 vs preceding-9 avg USD 131,111 — a 54.2% decline. Exceeds the 40% At Risk threshold.', evidence_label: 'Volume Decline', evidence_value: '−54.2%', threshold_label: 'At Risk threshold', threshold_value: '≥40%', detected_date: '2026-06-30', status: 'Open', observation_only: false },
  { id: 'DET-100517-R004-20260630', cif: 'CIF-100517', client_name: 'Pearl Coast Foodstuff and Logistics', coverage_segment: 'VIP', rule: 'RULE-004', rule_version: 'v1.2', severity: 'Medium', type: 'Material Volume Growth', description: 'Latest-3 month avg USD 78,000 vs preceding-9 avg USD 42,889 — an 81.9% increase. T12 volume USD 620,000.', evidence_label: 'Volume Growth', evidence_value: '+81.9%', threshold_label: 'Growth threshold', threshold_value: '≥120%', detected_date: '2026-06-30', status: 'Open', observation_only: false },
  { id: 'DET-100856-R005-20260630', cif: 'CIF-100856', client_name: 'National Marine Equipment and Contracting', coverage_segment: 'Institution', rule: 'RULE-005', rule_version: 'v1.3', severity: 'Medium', type: 'Spot-Only Product Mix', description: 'All 14 eligible deal legs and 100% of T12 volume (USD 1,800,000) are Spot. Zero Forward deal count and zero Forward volume over 12 active months.', evidence_label: 'Forward Deal Count', evidence_value: '0', threshold_label: 'Observation rule', threshold_value: 'N/A', detected_date: '2026-06-30', status: 'Open', observation_only: true },
];

export const alNoorJunTransactions: Transaction[] = [
  { seq: 1, txn_id: 'TXN-AN-202606-001', leg_id: 'TXN-AN-202606-001-L1', trade_date: '2026-06-01', maturity_date: '2026-06-03', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 3000, spot_rate: 1, usd_amount: 3000, profit_usd: 42, booking_status: 'Booked' },
  { seq: 2, txn_id: 'TXN-AN-202606-002', leg_id: 'TXN-AN-202606-002-L1', trade_date: '2026-06-02', maturity_date: '2026-06-04', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 3194.44, spot_rate: 1.08, usd_amount: 3450, profit_usd: 45, booking_status: 'Booked' },
  { seq: 3, txn_id: 'TXN-AN-202606-003', leg_id: 'TXN-AN-202606-003-L1', trade_date: '2026-06-03', maturity_date: '2026-06-05', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 3120, spot_rate: 1.25, usd_amount: 3900, profit_usd: 48, booking_status: 'Booked' },
  { seq: 4, txn_id: 'TXN-AN-202606-004', leg_id: 'TXN-AN-202606-004-L1', trade_date: '2026-06-04', maturity_date: '2026-06-06', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 4350, spot_rate: 1, usd_amount: 4350, profit_usd: 51, booking_status: 'Booked' },
  { seq: 5, txn_id: 'TXN-AN-202606-005', leg_id: 'TXN-AN-202606-005-L1', trade_date: '2026-06-05', maturity_date: '2026-06-07', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 4800, spot_rate: 1, usd_amount: 4800, profit_usd: 54, booking_status: 'Booked' },
  { seq: 6, txn_id: 'TXN-AN-202606-006', leg_id: 'TXN-AN-202606-006-L1', trade_date: '2026-06-06', maturity_date: '2026-06-08', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 4861.11, spot_rate: 1.08, usd_amount: 5250, profit_usd: 57, booking_status: 'Booked' },
  { seq: 7, txn_id: 'TXN-AN-202606-007', leg_id: 'TXN-AN-202606-007-L1', trade_date: '2026-06-07', maturity_date: '2026-06-09', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 4560, spot_rate: 1.25, usd_amount: 5700, profit_usd: 43, booking_status: 'Booked' },
  { seq: 8, txn_id: 'TXN-AN-202606-008', leg_id: 'TXN-AN-202606-008-L1', trade_date: '2026-06-08', maturity_date: '2026-06-10', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 3120, spot_rate: 1, usd_amount: 3120, profit_usd: 46, booking_status: 'Booked' },
  { seq: 9, txn_id: 'TXN-AN-202606-009', leg_id: 'TXN-AN-202606-009-L1', trade_date: '2026-06-09', maturity_date: '2026-06-11', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 3570, spot_rate: 1, usd_amount: 3570, profit_usd: 49, booking_status: 'Booked' },
  { seq: 10, txn_id: 'TXN-AN-202606-010', leg_id: 'TXN-AN-202606-010-L1', trade_date: '2026-06-10', maturity_date: '2026-06-12', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 3722.22, spot_rate: 1.08, usd_amount: 4020, profit_usd: 52, booking_status: 'Booked' },
  { seq: 11, txn_id: 'TXN-AN-202606-011', leg_id: 'TXN-AN-202606-011-L1', trade_date: '2026-06-11', maturity_date: '2026-06-13', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 3576, spot_rate: 1.25, usd_amount: 4470, profit_usd: 55, booking_status: 'Booked' },
  { seq: 12, txn_id: 'TXN-AN-202606-012', leg_id: 'TXN-AN-202606-012-L1', trade_date: '2026-06-12', maturity_date: '2026-06-14', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 4920, spot_rate: 1, usd_amount: 4920, profit_usd: 58, booking_status: 'Booked' },
  { seq: 13, txn_id: 'TXN-AN-202606-013', leg_id: 'TXN-AN-202606-013-L1', trade_date: '2026-06-13', maturity_date: '2026-06-15', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 5370, spot_rate: 1, usd_amount: 5370, profit_usd: 44, booking_status: 'Booked' },
  { seq: 14, txn_id: 'TXN-AN-202606-014', leg_id: 'TXN-AN-202606-014-L1', trade_date: '2026-06-14', maturity_date: '2026-06-16', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 5388.89, spot_rate: 1.08, usd_amount: 5820, profit_usd: 47, booking_status: 'Booked' },
  { seq: 15, txn_id: 'TXN-AN-202606-015', leg_id: 'TXN-AN-202606-015-L1', trade_date: '2026-06-15', maturity_date: '2026-06-17', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 2592, spot_rate: 1.25, usd_amount: 3240, profit_usd: 50, booking_status: 'Booked' },
  { seq: 16, txn_id: 'TXN-AN-202606-016', leg_id: 'TXN-AN-202606-016-L1', trade_date: '2026-06-16', maturity_date: '2026-06-18', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 3690, spot_rate: 1, usd_amount: 3690, profit_usd: 53, booking_status: 'Booked' },
  { seq: 17, txn_id: 'TXN-AN-202606-017', leg_id: 'TXN-AN-202606-017-L1', trade_date: '2026-06-17', maturity_date: '2026-06-19', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 4140, spot_rate: 1, usd_amount: 4140, profit_usd: 56, booking_status: 'Booked' },
  { seq: 18, txn_id: 'TXN-AN-202606-018', leg_id: 'TXN-AN-202606-018-L1', trade_date: '2026-06-18', maturity_date: '2026-06-20', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 4250, spot_rate: 1.08, usd_amount: 4590, profit_usd: 59, booking_status: 'Booked' },
  { seq: 19, txn_id: 'TXN-AN-202606-019', leg_id: 'TXN-AN-202606-019-L1', trade_date: '2026-06-19', maturity_date: '2026-06-21', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 4032, spot_rate: 1.25, usd_amount: 5040, profit_usd: 45, booking_status: 'Booked' },
  { seq: 20, txn_id: 'TXN-AN-202606-020', leg_id: 'TXN-AN-202606-020-L1', trade_date: '2026-06-20', maturity_date: '2026-06-22', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 5490, spot_rate: 1, usd_amount: 5490, profit_usd: 48, booking_status: 'Booked' },
  { seq: 21, txn_id: 'TXN-AN-202606-021', leg_id: 'TXN-AN-202606-021-L1', trade_date: '2026-06-21', maturity_date: '2026-06-23', product: 'Spot', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 5940, spot_rate: 1, usd_amount: 5940, profit_usd: 51, booking_status: 'Booked' },
  { seq: 22, txn_id: 'TXN-AN-202606-022', leg_id: 'TXN-AN-202606-022-L1', trade_date: '2026-06-22', maturity_date: '2026-06-24', product: 'Spot', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 3111.11, spot_rate: 1.08, usd_amount: 3360, profit_usd: 54, booking_status: 'Booked' },
  { seq: 23, txn_id: 'TXN-AN-202606-023', leg_id: 'TXN-AN-202606-023-L1', trade_date: '2026-06-23', maturity_date: '2026-06-25', product: 'Spot', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 3048, spot_rate: 1.25, usd_amount: 3810, profit_usd: 57, booking_status: 'Booked' },
  { seq: 24, txn_id: 'TXN-AN-202606-024', leg_id: 'TXN-AN-202606-024-L1', trade_date: '2026-06-24', maturity_date: '2026-06-26', product: 'Spot', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 8960, spot_rate: 1, usd_amount: 8960, profit_usd: 16, booking_status: 'Booked' },
  { seq: 25, txn_id: 'TXN-AN-202606-025', leg_id: 'TXN-AN-202606-025-L1', trade_date: '2026-06-25', maturity_date: '2026-07-25', product: 'Forward', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 4000, spot_rate: 1, usd_amount: 4000, profit_usd: 45, booking_status: 'Booked' },
  { seq: 26, txn_id: 'TXN-AN-202606-025', leg_id: 'TXN-AN-202606-025-L2', trade_date: '2026-06-26', maturity_date: '2026-08-25', product: 'Forward', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 4166.67, spot_rate: 1.08, usd_amount: 4500, profit_usd: 50, booking_status: 'Booked' },
  { seq: 27, txn_id: 'TXN-AN-202606-027', leg_id: 'TXN-AN-202606-027-L1', trade_date: '2026-06-27', maturity_date: '2026-09-25', product: 'Forward', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 4000, spot_rate: 1.25, usd_amount: 5000, profit_usd: 55, booking_status: 'Booked' },
  { seq: 28, txn_id: 'TXN-AN-202606-028', leg_id: 'TXN-AN-202606-028-L1', trade_date: '2026-06-28', maturity_date: '2026-10-26', product: 'Forward', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 5500, spot_rate: 1, usd_amount: 5500, profit_usd: 60, booking_status: 'Booked' },
  { seq: 29, txn_id: 'TXN-AN-202606-029', leg_id: 'TXN-AN-202606-029-L1', trade_date: '2026-06-01', maturity_date: '2026-07-01', product: 'Forward', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 6000, spot_rate: 1, usd_amount: 6000, profit_usd: 65, booking_status: 'Booked' },
  { seq: 30, txn_id: 'TXN-AN-202606-030', leg_id: 'TXN-AN-202606-030-L1', trade_date: '2026-06-02', maturity_date: '2026-08-01', product: 'Forward', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 3888.89, spot_rate: 1.08, usd_amount: 4200, profit_usd: 47, booking_status: 'Booked' },
  { seq: 31, txn_id: 'TXN-AN-202606-031', leg_id: 'TXN-AN-202606-031-L1', trade_date: '2026-06-03', maturity_date: '2026-09-01', product: 'Forward', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 3760, spot_rate: 1.25, usd_amount: 4700, profit_usd: 52, booking_status: 'Booked' },
  { seq: 32, txn_id: 'TXN-AN-202606-032', leg_id: 'TXN-AN-202606-032-L1', trade_date: '2026-06-04', maturity_date: '2026-10-02', product: 'Forward', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 5200, spot_rate: 1, usd_amount: 5200, profit_usd: 57, booking_status: 'Booked' },
  { seq: 33, txn_id: 'TXN-AN-202606-033', leg_id: 'TXN-AN-202606-033-L1', trade_date: '2026-06-05', maturity_date: '2026-07-05', product: 'Forward', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 5700, spot_rate: 1, usd_amount: 5700, profit_usd: 62, booking_status: 'Booked' },
  { seq: 34, txn_id: 'TXN-AN-202606-034', leg_id: 'TXN-AN-202606-034-L1', trade_date: '2026-06-06', maturity_date: '2026-08-05', product: 'Forward', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 5740.74, spot_rate: 1.08, usd_amount: 6200, profit_usd: 67, booking_status: 'Booked' },
  { seq: 35, txn_id: 'TXN-AN-202606-035', leg_id: 'TXN-AN-202606-035-L1', trade_date: '2026-06-07', maturity_date: '2026-09-05', product: 'Forward', direction: 'Customer Buys', currency_pair: 'GBP/USD', dealt_currency: 'GBP', gross_dealt: 3520, spot_rate: 1.25, usd_amount: 4400, profit_usd: 49, booking_status: 'Booked' },
  { seq: 36, txn_id: 'TXN-AN-202606-036', leg_id: 'TXN-AN-202606-036-L1', trade_date: '2026-06-08', maturity_date: '2026-10-06', product: 'Forward', direction: 'Customer Sells', currency_pair: 'USD/JPY', dealt_currency: 'USD', gross_dealt: 4900, spot_rate: 1, usd_amount: 4900, profit_usd: 54, booking_status: 'Booked' },
  { seq: 37, txn_id: 'TXN-AN-202606-037', leg_id: 'TXN-AN-202606-037-L1', trade_date: '2026-06-09', maturity_date: '2026-07-09', product: 'Forward', direction: 'Customer Buys', currency_pair: 'USD/KWD', dealt_currency: 'USD', gross_dealt: 5400, spot_rate: 1, usd_amount: 5400, profit_usd: 59, booking_status: 'Booked' },
  { seq: 38, txn_id: 'TXN-AN-202606-038', leg_id: 'TXN-AN-202606-038-L1', trade_date: '2026-06-10', maturity_date: '2026-08-09', product: 'Forward', direction: 'Customer Sells', currency_pair: 'EUR/USD', dealt_currency: 'EUR', gross_dealt: 7685.19, spot_rate: 1.08, usd_amount: 8300, profit_usd: 78, booking_status: 'Booked' },
];
