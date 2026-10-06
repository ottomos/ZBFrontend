import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'src', 'config', 'bank-symbols.json');

const defaultConfig = {
  KFH: [
    'USD/TRY', 'EUR/USD', 'XAU/USD', 'XAG/USD', 'XPT/USD', 'GBP/USD',
    'USD/CHF', 'USD/SAR', 'USD/KWD', 'USD/JPY', 'USD/CAD', 'USD/SEK',
    'USD/NOK', 'AUD/USD', 'NZD/USD', 'USD/AED', 'USD/BHD', 'USD/QAR', 'USD/OMR'
  ],
  KT: [
    'USD/TRY', 'EUR/TRY', 'GBP/TRY', 'XAU/USD', 'EUR/USD', 'GBP/USD',
    'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'EUR/JPY',
    'GBP/JPY', 'XAG/USD', 'XPT/USD', 'XPD/USD', 'USD/SAR', 'USD/KWD', 'USD/AED'
  ],
  AUB: [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD',
    'NZD/USD', 'USD/SAR', 'USD/BHD', 'USD/QAR', 'USD/KWD', 'USD/AED',
    'USD/OMR', 'XAU/USD', 'XAG/USD', 'XPT/USD', 'XPD/USD', 'USD/TRY', 'EUR/TRY'
  ]
};

function isSymbol(value) {
  return typeof value === 'string' && /^[A-Z]{3}\/[A-Z]{3}$/.test(value.trim());
}

function validateConfig(data) {
  const banks = ['KFH', 'KT', 'AUB'];
  for (const bank of banks) {
    if (!Array.isArray(data?.[bank]) || data[bank].length === 0) {
      throw new Error(`Missing or empty symbol list for ${bank}`);
    }

    const normalized = data[bank].map((item) => String(item).trim().toUpperCase());
    if (!normalized.every(isSymbol)) {
      throw new Error(`Invalid symbol format in ${bank}; expected values like EUR/USD`);
    }

    const unique = new Set(normalized);
    if (unique.size !== normalized.length) {
      throw new Error(`Duplicate symbols detected in ${bank}`);
    }
  }
}

if (!fs.existsSync(configPath)) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  console.log(`Created ${configPath}`);
}

const raw = fs.readFileSync(configPath, 'utf8');
const parsed = JSON.parse(raw);
validateConfig(parsed);
console.log('bank-symbols.json validated');
