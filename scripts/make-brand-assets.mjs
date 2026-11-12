// Regenerates the favicons and the social share image from the brand mark.
//   node scripts/make-brand-assets.mjs
// Needs: rsvg-convert, ImageMagick (`magick`) and a Chromium-family browser (BROWSER_BIN env var
// overrides the default path) for og.png. Writes into public/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(join(root, 'src/assets/brand/faleth-mark.svg'), 'utf8');
const [vx, vy, vw, vh] = raw.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const d = raw.match(/\sd="([^"]+)"/)[1];
const GOLD = '#E3C271';
const BG = '#142423';
const tmp = process.env.TMPDIR || tmpdir();

function iconSvg({ radius, markHeight }) {
	const s = markHeight / vh;
	const tx = (64 - vw * s) / 2 - vx * s;
	const ty = (64 - vh * s) / 2 - vy * s;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${BG}"/><g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(5)})"><path fill="${GOLD}" fill-rule="evenodd" d="${d}"/></g></svg>\n`;
}

const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });

// favicon.svg: rounded square
writeFileSync(join(pub, 'favicon.svg'), iconSvg({ radius: 14, markHeight: 42 }));
// apple touch icon: full bleed square (iOS rounds it itself)
const appleSvg = join(tmp, 'apple-icon.svg');
writeFileSync(appleSvg, iconSvg({ radius: 0, markHeight: 40 }));
execFileSync('rsvg-convert', ['-w', '180', '-h', '180', appleSvg, '-o', join(pub, 'apple-touch-icon.png')]);
// favicon.ico (32px)
const png32 = join(tmp, 'favicon-32.png');
execFileSync('rsvg-convert', ['-w', '32', '-h', '32', join(pub, 'favicon.svg'), '-o', png32]);
execFileSync('magick', [png32, join(pub, 'favicon.ico')]);

// og.png: render a tiny HTML page with the real Cinzel font
const fontFile = join(root, 'node_modules/@fontsource-variable/cinzel/files/cinzel-latin-wght-normal.woff2');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Cinzel;src:url(file://${fontFile}) format('woff2');font-weight:400 900}
html,body{margin:0;width:1200px;height:630px;background:${BG};overflow:hidden}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px}
svg{height:300px;width:auto;color:${GOLD}}
p{margin:0;font:600 64px Cinzel,serif;letter-spacing:.3em;text-indent:.3em;color:${GOLD};text-transform:uppercase}
</style>
<svg viewBox="${vx} ${vy} ${vw} ${vh}"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>
<p>Lyle Cole</p>`;
const ogHtml = join(tmp, 'og.html');
writeFileSync(ogHtml, html);
execFileSync(process.env.BROWSER_BIN || '/usr/bin/chromium', [
	'--headless=new', '--disable-gpu', '--hide-scrollbars',
	`--user-data-dir=${join(tmp, 'chromium-og')}`,
	'--window-size=1200,630', '--virtual-time-budget=3000',
	`--screenshot=${join(pub, 'og.png')}`, `file://${ogHtml}`,
], { stdio: 'inherit' });
console.log('wrote favicon.svg, favicon.ico, apple-touch-icon.png, og.png');
