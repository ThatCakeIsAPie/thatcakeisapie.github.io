import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { canonLoader } from './lib/canon-loader.mjs';

// The Faleth Capital documents, fetched into .canon/ by scripts/fetch-canon.mjs (see README).
const canon = defineCollection({
	loader: canonLoader(),
	schema: z.object({
		file: z.string(),
		order: z.number(),
		title: z.string(),
		tagline: z.string(),
		meta: z.string(),
		companionHtml: z.string(),
		updated: z.string().nullable(),
		headings: z.array(z.object({ depth: z.number(), slug: z.string(), text: z.string() })),
	}),
});

export const collections = { canon };
