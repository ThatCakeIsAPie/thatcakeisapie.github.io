#!/usr/bin/env node
// Post-build check of the Faleth Capital pages: every internal link in the document pages and in the
// /faleth/ index must point at an existing page, and every #anchor must exist as an id on its target.
// Also fails on leftover Obsidian syntax ([[ or %%) and checks the one-h1 rule.
// Usage: node scripts/check-canon-links.mjs [distDir]   (default: dist)
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CANON_FILES, docSlug } from '../src/lib/canon-docs.mjs';

const dist = resolve(process.argv[2] ?? 'dist');
const page = (urlPath) => join(dist, urlPath.replace(/^\/+/, ''), 'index.html');
const slugs = CANON_FILES.map(docSlug).filter((s) => existsSync(page(`/faleth/${s}/`)));
const pages = ['/faleth/', ...slugs.map((s) => `/faleth/${s}/`)];
const cache = new Map();
const html = (p) => (cache.has(p) ? cache.get(p) : (cache.set(p, existsSync(page(p)) ? readFileSync(page(p), 'utf8') : null), cache.get(p)));
const ids = (h) => new Set([...h.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]));

let checked = 0;
const problems = [];
for (const p of pages) {
	const h = html(p);
	if (!h) {
		problems.push(`${p}: page missing`);
		continue;
	}
	const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
	if (/\[\[|%%/.test(main)) problems.push(`${p}: raw [[ or %% in output`);
	const h1s = (main.match(/<h1[\s>]/g) ?? []).length;
	if (h1s !== 1) problems.push(`${p}: ${h1s} <h1> elements (want 1)`);
	for (const m of main.matchAll(/<a\s[^>]*?href="([^"]*)"/g)) {
		const href = m[1].replace(/&amp;/g, '&');
		if (/^(https?:|mailto:|tel:)/.test(href)) continue;
		checked++;
		const [path, hash] = href.split('#');
		const target = path === '' ? p : path;
		const th = html(target);
		if (!th) {
			problems.push(`${p}: ${href} -> page ${target} does not exist`);
			continue;
		}
		if (hash && !ids(th).has(decodeURIComponent(hash))) problems.push(`${p}: ${href} -> no id "${hash}" on ${target}`);
	}
}
console.log(`pages checked: ${pages.length} (${slugs.length} documents + index)`);
console.log(`internal links checked: ${checked}`);
console.log(`broken: ${problems.length}`);
for (const pr of problems) console.log('  - ' + pr);
if (slugs.length !== CANON_FILES.length) console.log(`note: ${CANON_FILES.length - slugs.length} allow-listed document page(s) missing`);
process.exit(problems.length ? 1 : 0);
