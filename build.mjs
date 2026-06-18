/*
 * build.mjs — assembles the static web app into www/ for Capacitor.
 *
 * The website itself has no build step (Firebase Hosting serves this folder
 * directly). Capacitor, however, needs a clean webDir to copy into the iOS app
 * bundle — we do NOT want .git, node_modules, the iOS project, spreadsheets,
 * etc. inside the app. So this script copies just the runtime assets into www/
 * and injects two native-only bits into index.html:
 *   1. window.__BACKEND_URL__  -> absolute API origin (no Hosting rewrite in-app)
 *   2. <script src="native.js"> -> the Capacitor integration layer
 *
 * Run: npm run build   (or npm run sync / npm run ios)
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'www');

// Runtime assets the app actually loads.
const FILES = ['app.js', 'styles.css', 'logo.png', 'email-banner.png', 'native.js'];
const DIRS = ['vendor'];

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  for (const f of FILES) {
    try { await fs.cp(path.join(ROOT, f), path.join(OUT, f), { recursive: true }); }
    catch (e) { console.warn('  skip file', f, '-', e.message); }
  }
  for (const d of DIRS) {
    try { await fs.cp(path.join(ROOT, d), path.join(OUT, d), { recursive: true }); }
    catch (e) { console.warn('  skip dir', d, '-', e.message); }
  }

  let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const inject = '  <script>window.__BACKEND_URL__ = "https://ohrchaim.org";</script>\n';
  html = html.replace('</head>', inject + '</head>');
  html = html.replace(
    '<script defer src="app.js"></script>',
    '<script defer src="app.js"></script>\n  <script defer src="native.js"></script>'
  );
  await fs.writeFile(path.join(OUT, 'index.html'), html);

  console.log('Built www/ for Capacitor (appId com.manneeducation.ohrchaim).');
}

main().catch((e) => { console.error(e); process.exit(1); });
