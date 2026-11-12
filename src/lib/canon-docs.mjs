// The Faleth Capital documents published on the site. This file is the single source of truth:
// the fetch script, the content loader and the pages all read it.
//
// ALLOW-LIST: only these top-level files are ever fetched or published, in this display order.
// To publish another document or follow a rename, edit this list.
export const CANON_REPO = 'ThatCakeIsAPie/MainVault';
export const CANON_BRANCH = 'main';
export const CANON_FOLDER = 'Business/Faleth Capital';
/** Local copy of the vault, used only when GitHub cannot be reached. */
export const CANON_LOCAL_FALLBACK = '/home/lyle/Documents/MainVault/Business/Faleth Capital';

export const CANON_FILES = [
	'Beyond the Wage.md',
	'Faleth Capital Constitution.md',
	'The Contribution Framework.md',
	'The Equity Framework.md',
	'The Financial Framework.md',
	'The Governance Framework.md',
	'The Cell Framework.md',
	'The Acquisition Transition Framework.md',
	'The Marketing and Brand Framework.md',
];

/** 'The Equity Framework.md' -> 'the-equity-framework' (the URL segment under /faleth/). */
export function docSlug(file) {
	return file
		.replace(/\.md$/i, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Document name as written in a wikilink -> allow-list file, or undefined. Case-insensitive. */
export function fileForName(name) {
	const n = name.trim().toLowerCase().replace(/\.md$/, '');
	return CANON_FILES.find((f) => f.toLowerCase().replace(/\.md$/, '') === n);
}
