// Live data contracts for the Sales > Deal screen.
//
//   PanelSalesRates_<entity>          -> SalesRate       (Kafka, GET /api/sales-rates)
//   sls.sel_DealerExecutions_<entity> -> DealerExecution (SQL SP, GET /api/sales/dealer-executions)
//
// Prices are kept as strings so trailing zeros coming from the feed
// (e.g. "55.7530060") survive untouched - the rate cards split them into
// head / big figure / pips and need the exact precision the feed sent.

export interface SalesRate {
  Symbol: string;
  SpotDate: string; // yyyyMMdd
  SpotBid: string;
  SpotAsk: string;
  SwapBid: string;
  SwapAsk: string;
  TodayDate: string; // yyyyMMdd
  TodayBid: string;
  TodayAsk: string;
  Producer: string;
  SystemDate: string;
}

export interface DealerExecution {
  DealerExecutionID?: number;
  DealID: string;
  Symbol: string;
  Side: string;
  BaseAmount: number;
  TranPrice: string;
  Price: string;
  CustomerID: string;
  ValueDate: string; // yyyyMMdd
  Type: string; // 'Insert' | 'Update'
  Producer: string;
  SystemDate: string;
  User: string;
  // Not returned by sls.sel_DealerExecutions_<entity>; left undefined until the
  // source for it is agreed.
  PnlUsd?: number;
}

// Splits a feed price into the three parts used by the rate cards:
// "55.7530060" -> head "55.75", big "30", tail "060".
// Quotes with two decimals or fewer keep the decimals as the big figure:
// "2334.10" -> head "2334.", big "10", tail "".
export function splitPrice(value: string): { head: string; big: string; tail: string } {
  const [intPart, decPart = ''] = String(value).split('.');
  if (decPart.length <= 2) {
    return { head: decPart ? `${intPart}.` : intPart, big: decPart, tail: '' };
  }
  return {
    head: `${intPart}.${decPart.slice(0, 2)}`,
    big: decPart.slice(2, 4),
    tail: decPart.slice(4),
  };
}

// yyyyMMdd -> dd.MM.yyyy
export function formatFeedDate(value: string): string {
  const raw = String(value || '');
  if (raw.length !== 8) return raw;
  return `${raw.slice(6, 8)}.${raw.slice(4, 6)}.${raw.slice(0, 4)}`;
}

// JSON values coming back from the API are only ever strings, numbers or null;
// anything else is treated as absent rather than stringified into junk.
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

// The SP returns ValueDate as a DATE, which arrives as an ISO string over JSON.
// The rate feed already uses yyyyMMdd, so normalise both to yyyyMMdd.
function toFeedDate(value: unknown): string {
  const raw = asText(value);
  if (/^\d{8}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}${month}${day}`;
}

// yyyy-MM-ddTHH:mm:ss.sssZ -> yyyy-MM-dd HH:mm:ss.sss (what the feed sends)
function toFeedTimestamp(value: unknown): string {
  const raw = asText(value);
  if (!raw.includes('T')) return raw;
  return raw.replace('T', ' ').replace('Z', '');
}

export async function fetchSalesRates(profile: string): Promise<SalesRate[]> {
  const response = await fetch(`/api/sales-rates?profile=${encodeURIComponent(profile)}`);
  if (!response.ok) throw new Error(`sales-rates failed: ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows as SalesRate[];
}

export async function fetchDealerExecutions(profile: string): Promise<DealerExecution[]> {
  const response = await fetch(`/api/sales/dealer-executions?profile=${encodeURIComponent(profile)}`);
  if (!response.ok) throw new Error(`dealer-executions failed: ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return rows.map((row: Record<string, unknown>): DealerExecution => ({
    DealerExecutionID: Number(row.DealerExecutionID) || undefined,
    DealID: asText(row.DealID),
    Symbol: asText(row.Symbol),
    Side: asText(row.Side),
    BaseAmount: Number(row.BaseAmount) || 0,
    TranPrice: asText(row.TranPrice),
    Price: asText(row.Price),
    CustomerID: asText(row.CustomerID),
    ValueDate: toFeedDate(row.ValueDate),
    Type: asText(row.Type),
    Producer: asText(row.Producer),
    SystemDate: toFeedTimestamp(row.SystemDate),
    User: asText(row.User),
  }));
}

// ---------------------------------------------------------------------------
// Write path: Buy/Sell publishes to PanelDealerExecutions_<entity>.
// ---------------------------------------------------------------------------

// DealID format from the spec: yyMMdd_HHmmss_N. N restarts every second, so a
// dealer clicking twice inside the same second still gets a unique id.
let dealSequence = 0;
let dealSequenceSecond = '';

function nextDealId(now: Date): string {
  const stamp =
    `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}_` +
    `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}` +
    `${String(now.getSeconds()).padStart(2, '0')}`;
  if (stamp !== dealSequenceSecond) {
    dealSequenceSecond = stamp;
    dealSequence = 0;
  }
  dealSequence += 1;
  return `${stamp}_${dealSequence}`;
}

// yyyy-MM-dd HH:mm:ss.fff
function nowSystemDate(now: Date): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
  );
}

export interface NewDeal {
  Symbol: string;
  Side: string;
  BaseAmount: number;
  Price: string;
  ValueDate: string; // yyyyMMdd
  CustomerID: string;
  User: string;
}

// A price typed on a Turkish keyboard arrives as "1,15445". Left alone it would
// split into two fields and the consumer would drop the whole message, so the
// decimal separator is normalised instead of rejected.
function normalisePrice(value: string): string {
  return String(value).trim().replaceAll(' ', '').replace(',', '.');
}

// Free text can never carry a comma into the payload for the same reason.
function normaliseText(value: string): string {
  return String(value).replaceAll(',', ' ').trim();
}

interface DealMessage {
  DealID: string;
  Symbol: string;
  Side: string;
  BaseAmount: number;
  TranPrice: string;
  Price: string;
  CustomerID: string;
  ValueDate: string;
  Type: 'Insert' | 'Update';
  SystemDate: string;
  User: string;
}

// The consumer splits the payload on "," and rejects anything that is not
// exactly 12 fields, so no value may contain a comma. Fields are joined without
// padding spaces so the raw message matches what the feed itself publishes.
function buildMessage(fields: DealMessage): string {
  return [
    fields.DealID,
    fields.Symbol,
    fields.Side,
    fields.BaseAmount.toFixed(2),
    normalisePrice(fields.TranPrice),
    normalisePrice(fields.Price),
    normaliseText(fields.CustomerID),
    fields.ValueDate,
    fields.Type,
    'Python',
    fields.SystemDate,
    normaliseText(fields.User),
  ].join(',');
}

async function publishMessage(profile: string, key: string, value: string): Promise<void> {
  const response = await fetch('/api/sales/dealer-executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: `PanelDealerExecutions_${profile}`,
      key,
      value,
      profile,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`publish deal failed: ${response.status} ${details}`);
  }
}

export async function publishDeal(profile: string, deal: NewDeal): Promise<void> {
  const now = new Date();
  const message = buildMessage({
    DealID: nextDealId(now),
    Symbol: deal.Symbol,
    Side: deal.Side,
    BaseAmount: deal.BaseAmount,
    TranPrice: deal.Price, // TranPrice starts equal to the executed price
    Price: deal.Price,
    CustomerID: deal.CustomerID,
    ValueDate: deal.ValueDate,
    Type: 'Insert',
    SystemDate: nowSystemDate(now),
    User: deal.User,
  });

  await publishMessage(profile, deal.Symbol, message);
}

// Blotter edit. Only Customer ID and Tran Price may change; the remaining
// fields are echoed back from the stored row because the consumer's UPDATE
// overwrites all twelve columns, so anything left blank would wipe the deal.
// Reusing the original DealID is what makes it an update rather than a new deal.
export async function publishDealUpdate(
  profile: string,
  row: DealerExecution,
  edit: { CustomerID: string; TranPrice: string }
): Promise<void> {
  const message = buildMessage({
    DealID: row.DealID,
    Symbol: row.Symbol,
    Side: row.Side,
    BaseAmount: row.BaseAmount,
    TranPrice: edit.TranPrice,
    Price: row.Price,
    CustomerID: edit.CustomerID,
    ValueDate: row.ValueDate,
    Type: 'Update',
    // The original booking time is echoed back, not restamped: an amendment
    // must not move the deal in the blotter's Timestamp ordering. The value
    // round-trips unchanged (DATETIME -> ISO -> 'yyyy-MM-dd HH:mm:ss.fff').
    SystemDate: row.SystemDate || nowSystemDate(new Date()),
    // Kept as the dealer who booked the deal - the blotter's User column is
    // there to show who dealt, not who last retyped a counterparty.
    User: row.User,
  });

  await publishMessage(profile, row.Symbol, message);
}

