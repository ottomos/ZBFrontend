import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const configPath = path.join(rootDir, 'src', 'config', 'bank-symbols.json');
const requiredBanks = ['KFH', 'KT', 'AUB'];

function fail(message) {
  console.error(`❌ bank-symbols config error: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  fail(`Missing file at ${configPath}`);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(`Invalid JSON syntax (${error.message})`);
}

for (const bank of requiredBanks) {
  const list = parsed?.[bank];
  if (!Array.isArray(list) || list.length === 0) {
    fail(`${bank} must be a non-empty symbol array`);
  }

  const normalized = list.map((value) => String(value || '').trim());
  if (normalized.some((value) => value.length === 0)) {
    fail(`${bank} contains empty symbol values`);
  }

  const duplicates = normalized.filter((value, index) => normalized.indexOf(value) !== index);
  if (duplicates.length > 0) {
    fail(`${bank} contains duplicate symbols: ${Array.from(new Set(duplicates)).join(', ')}`);
  }
}

console.log('✅ bank-symbols config validated');
