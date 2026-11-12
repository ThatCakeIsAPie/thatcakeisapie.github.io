// Pure text helpers for the Faleth Capital documents (Obsidian-flavoured markdown). No wording is ever
// changed: this only splits off the title block, drops Obsidian-only syntax and turns wikilinks into links.
import { fileForName, docSlug } from './canon-docs.mjs';

/** Apply `fn` to the prose parts of a markdown string, leaving fenced code blocks untouched. */
function mapOutsideFences(src, fn) {
	const lines = src.split('\n');
	const out = [];
	let prose = [];
	let fence = null;
	const flush = () => {
		if (prose.length) out.push(fn(prose.join('\n')));
		prose = [];
	};
	for (const line of lines) {
		const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
		if (fence) {
			out.push(line);
			if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
		} else if (m) {
			flush();
			fence = m[1];
			out.push(line);
		} else prose.push(line);
	}
	flush();
	return out.join('\n');
}

/** Drop `%%obsidian comments%%` (may span lines) and `![[embeds]]`. */
export function stripObsidian(src) {
	return mapOutsideFences(src, (t) => t.replace(/%%[\s\S]*?%%/g, '').replace(/!\[\[[^\]\n]*\]\]/g, ''));
}

const ITALIC_LINE = /^(?:\*(?!\*)(.+)\*|_(?!_)(.+)_)\s*$/;
const H1 = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/;

/**
 * Split a document into { title, tagline, meta, companion, body }.
 * Layout: `# Title`, then italic lines (tagline, version line, optional companion line), then `---`.
 * A document with no leading H1 (e.g. an essay) takes its title from the file name and keeps all text.
 */
export function parseDocument(raw, file) {
	const src = stripObsidian(raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
	const lines = src.split('\n');
	let i = 0;
	while (i < lines.length && !lines[i].trim()) i++;
	const h1 = H1.exec(lines[i] ?? '');
	if (!h1) {
		return { title: file.replace(/\.md$/i, ''), tagline: '', meta: '', companion: '', body: src.trim() + '\n' };
	}
	const title = h1[1].trim();
	i++;
	const italics = [];
	for (;;) {
		while (i < lines.length && !lines[i].trim()) i++;
		const m = ITALIC_LINE.exec(lines[i] ?? '');
		if (!m) break;
		italics.push((m[1] ?? m[2]).trim());
		i++;
	}
	let j = i;
	while (j < lines.length && !lines[j].trim()) j++;
	if (/^-{3,}\s*$/.test(lines[j] ?? '')) i = j + 1;
	const versionAt = italics.findIndex((l) => /\bversion\s+\d/i.test(l));
	const rest = italics.filter((_, k) => k !== versionAt);
	return {
		title,
		tagline: rest[0] ?? '',
		meta: versionAt >= 0 ? italics[versionAt] : '',
		companion: rest.slice(1).map((l) => `*${l}*`).join('\n\n'),
		body: lines.slice(i).join('\n').replace(/^\n+/, ''),
	};
}

/** Lower-case, letters and digits only, single spaces: lets `Article VI Acquisitions` match `Article VI: Acquisitions`. */
export const normHeading = (s) =>
	s
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

const esc = (s) => s.replace(/([\\[\]])/g, '\\$1');

/**
 * Replace `[[Doc]]`, `[[Doc|alias]]`, `[[Doc#Heading]]`, `[[Doc#Heading|alias]]`, `[[#Heading]]`.
 * `registry`: Map(file -> { slug, headings: [{ text, slug }] }); `currentFile`: file being rendered.
 * With `{ plain: true }` only the display text is emitted (used to measure headings before linking).
 * Returns the new text; `onWarn(message)` is called for unresolved headings.
 */
export function rewriteWikilinks(src, { registry, currentFile, plain = false, onWarn = () => {} }) {
	return mapOutsideFences(src, (text) =>
		// inline code spans are matched first so [[...]] inside backticks is left alone
		text.replace(/(`+)[\s\S]*?\1|\[\[([^\]\n|#]*)(?:#([^\]\n|]*))?(?:\|([^\]\n]*))?\]\]/g, (all, _tick, name, heading, alias) => {
			if (all[0] === '`') return all;
			name = (name ?? '').trim();
			const hasHeading = heading !== undefined;
			heading = (heading ?? '').trim();
			const file = name ? fileForName(name) : currentFile;
			const display = (alias ?? '').trim() || (hasHeading && !name ? heading : name) || heading;
			if (!file) return esc(display); // not one of the published documents: plain text
			if (plain) return esc(display);
			// listed but not fetched (renamed upstream): no page to link to, so plain text
			if (file !== currentFile && !registry.has(file)) return esc(display);
			const target = registry.get(file);
			let url = name && file !== currentFile ? `/faleth/${docSlug(file)}/` : '';
			if (hasHeading && heading) {
				const exact = target?.headings.find((h) => h.text === heading);
				const fuzzy = target?.headings.find((h) => normHeading(h.text) === normHeading(heading));
				const hit = exact ?? fuzzy;
				if (hit) url += `#${hit.slug}`;
				else onWarn(`"${all}" in ${currentFile}: no heading "${heading}" in ${file}`);
			}
			if (!url) url = `/faleth/${docSlug(file)}/`;
			return `[${esc(display)}](${url})`;
		}),
	);
}
