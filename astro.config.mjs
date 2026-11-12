// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { canonHeadingIds, canonHeadingShift, canonTableWrap } from './src/lib/canon-plugins.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://coleholistics.us',
	markdown: {
		// Only the Faleth Capital documents (src/lib/canon-loader.mjs) go through Markdown.
		// Smart punctuation is off: the documents' wording and punctuation must reach the page untouched.
		processor: satteri({
			features: { smartPunctuation: false },
			mdastPlugins: [canonHeadingShift],
			hastPlugins: [canonHeadingIds, canonTableWrap],
		}),
	},
});
