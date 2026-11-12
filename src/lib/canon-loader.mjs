// Content-collection loader for the Faleth Capital documents in .canon/ (written by scripts/fetch-canon.mjs).
// Two passes: (1) render each document with wikilinks flattened to text to learn its heading ids, then
// (2) render again with wikilinks turned into links that use those ids. Both passes run through the same
// Markdown processor and heading-id plugin, so a link anchor always equals the id on the target page.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CANON_FILES, docSlug } from './canon-docs.mjs';
import { parseDocument, rewriteWikilinks } from './canon-markdown.mjs';

const canonDir = () => join(process.cwd(), '.canon');

async function loadAll({ store, renderMarkdown, generateDigest, parseData, logger }) {
	const dir = canonDir();
	if (!existsSync(join(dir, 'meta.json'))) {
		throw new Error('[canon] .canon/meta.json not found. Run `npm run canon` to fetch the Faleth Capital documents.');
	}
	const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
	const updatedBy = new Map(meta.files.map((f) => [f.file, f.lastUpdated]));

	const docs = [];
	for (const file of CANON_FILES) {
		const path = join(dir, file);
		if (!existsSync(path)) {
			logger.warn(`"${file}" is not in .canon/ (missing upstream?); it will not be published.`);
			continue;
		}
		const raw = await readFile(path, 'utf8');
		docs.push({ file, path, raw, slug: docSlug(file), ...parseDocument(raw, file) });
	}
	if (!docs.length) throw new Error('[canon] .canon/ has no documents. Run `npm run canon`.');

	// Pass 1: heading ids.
	const registry = new Map();
	for (const d of docs) {
		const flat = rewriteWikilinks(d.body, { registry, currentFile: d.file, plain: true });
		const r = await renderMarkdown(flat, { fileURL: pathToFileURL(d.path) });
		d.headings = (r.metadata?.headings ?? []).map(({ depth, slug, text }) => ({ depth, slug, text }));
		registry.set(d.file, { slug: d.slug, headings: d.headings });
	}

	// Pass 2: real render.
	const all = docs.map((d) => d.raw).join('\u0000') + JSON.stringify(meta.files);
	store.clear();
	for (const [order, d] of docs.entries()) {
		const onWarn = (m) => logger.warn(m);
		const linked = rewriteWikilinks(d.body, { registry, currentFile: d.file, onWarn });
		const rendered = await renderMarkdown(linked, { fileURL: pathToFileURL(d.path) });
		let companionHtml = '';
		if (d.companion) {
			const c = rewriteWikilinks(d.companion, { registry, currentFile: d.file, onWarn });
			companionHtml = (await renderMarkdown(c, { fileURL: pathToFileURL(d.path) })).html;
		}
		const tagline = rewriteWikilinks(d.tagline, { registry, currentFile: d.file, plain: true });
		const data = await parseData({
			id: d.slug,
			data: {
				file: d.file,
				order,
				title: d.title,
				tagline,
				meta: rewriteWikilinks(d.meta, { registry, currentFile: d.file, plain: true }),
				companionHtml,
				updated: updatedBy.get(d.file) ?? null,
				headings: d.headings,
			},
		});
		// The digest covers every document: a heading change in one can change links in another.
		store.set({ id: d.slug, data, body: d.body, rendered, digest: generateDigest(all + d.file) });
	}
	logger.info(`loaded ${docs.length} Faleth Capital documents${meta.source?.sha ? ` @ ${meta.source.sha.slice(0, 7)}` : ''}`);
}

export function canonLoader() {
	return {
		name: 'faleth-canon',
		async load(ctx) {
			await loadAll(ctx);
			if (ctx.watcher) {
				const dir = canonDir();
				ctx.watcher.add(dir);
				ctx.watcher.on('change', async (p) => {
					if (p.startsWith(dir)) await loadAll(ctx).catch((e) => ctx.logger.error(String(e.message ?? e)));
				});
			}
		},
	};
}
