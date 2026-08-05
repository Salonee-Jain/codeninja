/**
 * Copies Monaco's AMD build into public/monaco so the editor and its web workers
 * are served from our own origin instead of jsDelivr. Runs before `dev` and `build`.
 *
 * monaco-editor's exports map does not expose ./package.json, so the package root
 * is located by walking up from a file we can resolve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const webRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function findMonacoRoot() {
  // 1. Whatever the module resolver gives us for the ESM entry.
  try {
    const entry = require.resolve('monaco-editor');
    const idx = entry.lastIndexOf(`${path.sep}monaco-editor${path.sep}`);
    if (idx !== -1) return entry.slice(0, idx + `${path.sep}monaco-editor`.length);
  } catch {
    /* fall through */
  }
  // 2. Plain node_modules lookup, walking up from the web app.
  let dir = webRoot;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'node_modules', 'monaco-editor');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

const root = findMonacoRoot();
if (!root) {
  console.warn('  ⚠ monaco-editor not found — the editor will fall back to the CDN.');
  process.exit(0);
}

const src = path.join(root, 'min', 'vs');
if (!fs.existsSync(src)) {
  console.warn(`  ⚠ ${src} not found — skipping the Monaco copy.`);
  process.exit(0);
}

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(webRoot, 'public', 'monaco');
const stamp = path.join(outDir, '.version');

if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === version) process.exit(0);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'vs'), { recursive: true });
fs.cpSync(src, path.join(outDir, 'vs'), { recursive: true });
fs.writeFileSync(stamp, version);

console.log(`  ✓ Monaco ${version} copied to public/monaco/vs`);
