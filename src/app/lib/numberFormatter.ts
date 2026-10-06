/**
 * Format numbers with proper thousand separators (commas)
 * Handles large numbers (8+ digits) correctly
 * @param value - The numeric value to format
 * @returns Formatted string with commas
 */
export function formatNumberWithCommas(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return String(value);
  
  // Split into integer and decimal parts
  const parts = num.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Combine back with decimal if it exists
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

/**
 * Format currency values with proper thousand separators
 * @param value - The numeric value to format
 * @returns Formatted string as currency (e.g., "$1,234,567.89")
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return String(value);
  
  return `$ ${formatNumberWithCommas(num)}`;
}

/**
 * Append "(oz)" to precious-metal symbols (base currency XAU, XAG, XPT, XPD),
 * whose amounts are quoted in troy ounces. Handles both single-currency symbols
 * (e.g. "XAU") and pairs (e.g. "XAU/USD").
 * @param symbol - The symbol/currency to label
 * @returns The symbol with " (oz)" appended when it is a precious metal
 */
export function withPreciousMetalUnit(symbol?: string | null): string {
  const raw = String(symbol ?? '').trim();
  if (!raw) return raw;
  const base = raw.split(/[/\\-]/)[0].trim().toUpperCase();
  return /^X(AU|AG|PT|PD)$/.test(base) ? `${raw} (oz)` : raw;
}

export function parseDecimalValue(value?: number | string | null): number {
  if (value === undefined || value === null) return NaN;
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  if (!raw) return NaN;
  // Handle exponential/scientific notation (e.g. 8.18741760E7)
  if (/[eE]/.test(raw)) {
    let normalized = raw.replace(/\s+/g, '');
    // remove thousands separators like commas
    normalized = normalized.replace(/,/g, '');
    // allow digits, dot, signs and exponent markers only
    normalized = normalized.replace(/[^0-9eE+\-.]/g, '');
    const parsedExp = Number(normalized);
    return Number.isFinite(parsedExp) ? parsedExp : NaN;
  }

  let normalized = raw.replace(/\s+/g, '');
  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');
  if (commaIndex > dotIndex) {
    normalized = normalized.replace(/\./g, '');
    normalized = normalized.replace(/,/g, '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }
  normalized = normalized.replace(/[^0-9.\-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
