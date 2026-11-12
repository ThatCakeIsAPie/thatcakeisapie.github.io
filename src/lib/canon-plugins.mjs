// Sätteri (Astro 7's default Markdown processor) plugins for the Faleth Capital documents.
// Plain plugin objects, so no extra dependency is needed.
import GithubSlugger from 'github-slugger';

/** Fenced-code-aware smallest ATX heading depth in a markdown string (0 when there is no heading). */
function minHeadingDepth(src) {
	let fence = null;
	let min = 0;
	for (const line of src.split('\n')) {
		const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
		if (fence) {
			if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
			continue;
		}
		if (f) {
			fence = f[1];
			continue;
		}
		const h = /^ {0,3}(#{1,6})[ \t]/.exec(line);
		if (h && (min === 0 || h[1].length < min)) min = h[1].length;
	}
	return min;
}

/**
 * The page template owns the one <h1> (the document title), so body headings start at h2:
 * the shallowest heading in the body becomes h2 and the rest shift by the same amount
 * (`#` -> h2 and `##` -> h3 in the Constitution; `##` stays h2 in documents that already start there).
 */
export const canonHeadingShift = (ctx) => {
	const min = minHeadingDepth(ctx.source);
	if (!min || min === 2) return null;
	const shift = 2 - min;
	return {
		name: 'canon-heading-shift',
		heading(node, ctx2) {
			ctx2.setField(node, 'depth', Math.min(6, Math.max(2, node.depth + shift)));
		},
	};
};

/** Stable heading ids: github-slugger over the heading's text, in document order (`-1` for repeats). */
export const canonHeadingIds = () => {
	const slugger = new GithubSlugger();
	return {
		name: 'canon-heading-ids',
		element: {
			filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
			visit(node, ctx) {
				ctx.setProperty(node, 'id', slugger.slug(ctx.textContent(node)));
			},
		},
	};
};

/** Wrap every table in a horizontally scrollable, keyboard-focusable container. */
export const canonTableWrap = {
	name: 'canon-table-wrap',
	element: {
		filter: ['table'],
		visit(node, ctx) {
			ctx.wrapNode(node, {
				type: 'element',
				tagName: 'div',
				properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: 'Table (scrolls sideways)' },
				children: [],
			});
		},
	},
};
