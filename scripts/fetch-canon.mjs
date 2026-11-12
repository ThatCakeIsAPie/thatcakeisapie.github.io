#!/usr/bin/env node
// Downloads the Faleth Capital documents (allow-list in src/lib/canon-docs.mjs) into .canon/ and
// writes .canon/meta.json. Run by `npm run build`, `npm run dev` (pre-scripts) and `npm run canon`.
//
// 1. Resolve the current commit SHA of MainVault `main` via the GitHub API (no-cache), then download
//    every file from the SHA-pinned raw URL, so a build can never see stale branch-cached content.
//    If the SHA lookup fails, fall back to the `main` branch URL (may be a few minutes stale).
// 2. For each file ask the commits API for its last commit date (-> meta.json lastUpdated).
// 3. If GitHub cannot be reached at all, fall back to the local vault copy (lastUpdated = file mtime).
// 4. Nothing worked: exit 1, so the build fails instead of publishing a site with missing documents.
//
// Sends `Authorization: Bearer $GITHUB_TOKEN` when that variable is set (CI), otherwise unauthenticated.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CANON_BRANCH,
	CANON_FILES,
	CANON_FOLDER,
	CANON_LOCAL_FALLBACK,
	CANON_REPO,
} from '../src/lib/canon-docs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.canon');
const token = process.env.GITHUB_TOKEN;
const warn = (m) => console.warn(`\x1b[33m[canon] WARNING: ${m}\x1b[0m`);
const log = (m) => console.log(`[canon] ${m}`);

const apiHeaders = {
	Accept: 'application/vnd.github+json',
	'User-Agent': 'personal-website-fetch-canon',
	'X-GitHub-Api-Version': '2022-11-28',
	'Cache-Control': 'no-cache',
	...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function http(url, headers, tries = 3) {
	let lastErr;
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
			if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			lastErr = err;
			if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
		}
	}
	throw lastErr;
}

const rawUrl = (ref, file) =>
	`https://raw.githubusercontent.com/${CANON_REPO}/${ref}/${CANON_FOLDER.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(file)}`;

async function resolveSha() {
	const res = await http(`https://api.github.com/repos/${CANON_REPO}/commits/${CANON_BRANCH}`, apiHeaders);
	if (!res.ok) throw new Error(`commits/${CANON_BRANCH} -> HTTP ${res.status}`);
	const sha = (await res.json()).sha;
	if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('unexpected API response (no commit sha)');
	return sha;
}

async function lastUpdated(file, ref) {
	const path = `${CANON_FOLDER}/${file}`;
	const url = `https://api.github.com/repos/${CANON_REPO}/commits?path=${encodeURIComponent(path)}&sha=${ref}&per_page=1`;
	const res = await http(url, apiHeaders);
	if (!res.ok) throw new Error(`commits?path -> HTTP ${res.status}`);
	const [c] = await res.json();
	const d = c?.commit?.committer?.date ?? c?.commit?.author?.date;
	if (!d) throw new Error('no commit found for path');
	return d;
}

async function fromNetwork() {
	let sha = null;
	let ref;
	try {
		sha = await resolveSha();
		ref = sha;
		log(`MainVault ${CANON_BRANCH} is at ${sha}`);
	} catch (err) {
		warn(`could not resolve the current commit SHA (${err.message}); using the "${CANON_BRANCH}" branch URL, which GitHub may serve a few minutes stale.`);
		ref = CANON_BRANCH;
	}
	const files = [];
	for (const file of CANON_FILES) {
		const res = await http(rawUrl(ref, file), { 'User-Agent': 'personal-website-fetch-canon', 'Cache-Control': 'no-cache' });
		if (res.status === 404) {
			console.error(`\x1b[31m[canon] !!! MISSING UPSTREAM: "${file}" was not found at ${CANON_REPO}@${ref}/${CANON_FOLDER}. It was renamed or deleted; it will NOT be published. Update src/lib/canon-docs.mjs.\x1b[0m`);
			continue;
		}
		if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`);
		const content = await res.text();
		let updated;
		try {
			updated = await lastUpdated(file, ref);
		} catch (err) {
			updated = null;
			warn(`no last-commit date for "${file}" (${err.message}); the page will omit "Updated".`);
		}
		files.push({ file, content, lastUpdated: updated });
	}
	return { sha, ref, mode: sha ? 'github-sha' : 'github-branch', files };
}

async function fromLocal() {
	if (!existsSync(CANON_LOCAL_FALLBACK)) return null;
	const files = [];
	for (const file of CANON_FILES) {
		const p = join(CANON_LOCAL_FALLBACK, file);
		if (!existsSync(p)) {
			console.error(`\x1b[31m[canon] !!! MISSING LOCALLY: "${file}" is not in ${CANON_LOCAL_FALLBACK}; it will NOT be published.\x1b[0m`);
			continue;
		}
		files.push({ file, content: await readFile(p, 'utf8'), lastUpdated: (await stat(p)).mtime.toISOString() });
	}
	return { sha: null, ref: 'local', mode: 'local-vault', files };
}

let result;
try {
	result = await fromNetwork();
} catch (err) {
	warn(`GitHub fetch failed (${err.message}).`);
	result = await fromLocal();
	if (result) {
		warn(`USING THE LOCAL VAULT COPY at ${CANON_LOCAL_FALLBACK} (dates = file mtimes). This content may differ from GitHub. Never deploy a build made this way.`);
	}
}

if (!result || result.files.length === 0) {
	console.error('\x1b[31m[canon] FAILED: could not get the Faleth Capital documents from GitHub or from the local vault. Refusing to continue: a build now would publish a site with missing documents.\x1b[0m');
	process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir)) if (f.endsWith('.md')) await rm(join(outDir, f));
for (const f of result.files) await writeFile(join(outDir, f.file), f.content);
await writeFile(
	join(outDir, 'meta.json'),
	JSON.stringify(
		{
			source: { repo: CANON_REPO, branch: CANON_BRANCH, folder: CANON_FOLDER, sha: result.sha, mode: result.mode },
			fetchedAt: new Date().toISOString(),
			files: result.files.map(({ file, lastUpdated }) => ({ file, lastUpdated })),
		},
		null,
		'\t',
	) + '\n',
);

const missing = CANON_FILES.length - result.files.length;
log(`wrote ${result.files.length}/${CANON_FILES.length} documents to .canon/ (source: ${result.mode}${result.sha ? ` @ ${result.sha}` : ''})`);
if (missing) warn(`${missing} listed document(s) missing; see the messages above.`);
