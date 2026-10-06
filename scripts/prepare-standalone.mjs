// `output: 'standalone'` emits a self-contained server at .next/standalone, but
// Next deliberately leaves the static assets out of it. The Dockerfile copies
// them in by hand (see COPY .next/static and COPY public); this script does the
// same thing for `npm start` on a developer machine, so both paths serve an
// identical tree.
import { cp, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

if (!(await exists(join(standalone, 'server.js')))) {
  console.error('No standalone build found at .next/standalone - run `npm run build` first.');
  process.exit(1);
}

await cp(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });

if (await exists(join(root, 'public'))) {
  await cp(join(root, 'public'), join(standalone, 'public'), { recursive: true });
}

console.log('standalone assets staged');
