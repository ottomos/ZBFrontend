import bankSymbols from '../../config/bank-symbols.json';

type BankCode = 'KFH' | 'KT' | 'AUB';

const FALLBACK_ORDER = [
  'USD/TRY', 'EUR/USD', 'XAU/USD', 'XAG/USD', 'XPT/USD', 'GBP/USD',
  'USD/CHF', 'USD/SAR', 'USD/KWD', 'USD/JPY', 'USD/CAD', 'USD/SEK',
  'USD/NOK', 'AUD/USD', 'NZD/USD', 'USD/AED', 'USD/BHD', 'USD/QAR', 'USD/OMR'
];

const BANK_SYMBOLS = bankSymbols as Record<BankCode, string[]>;

function normalizeBank(entity?: string | null): BankCode {
  const code = String(entity || '').trim().toUpperCase();
  if (code === 'KT' || code === 'AUB' || code === 'KFH') return code;
  return 'KFH';
}

export function getSymbolOrder(entity?: string | null): string[] {
  const bank = normalizeBank(entity);
  const symbols = BANK_SYMBOLS[bank];
  if (Array.isArray(symbols) && symbols.length > 0) return symbols;
  return FALLBACK_ORDER;
}

export function getDefaultSymbols(entity?: string | null, count = 7): string[] {
  return getSymbolOrder(entity).slice(0, count);
}

export const TABLE_HEADER_ROW_HEIGHT = 40;
export const TABLE_HEADER_CONTENT_HEIGHT = 30;
export const TABLE_BODY_ROW_HEIGHT = 27;
export const TABLE_BODY_CONTENT_HEIGHT = 23;

// Backward compatibility for any remaining usage paths
export const SYMBOL_ORDER = getSymbolOrder('KFH');
