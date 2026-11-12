# Lyle Cole, personal site

Built with [Astro](https://astro.build) (static) and hosted on GitHub Pages at https://coleholistics.us.
Pushing to `main` deploys it (see `.github/workflows/deploy.yml`).

- `npm run dev` starts a local preview at http://localhost:4321
- `npm run build` builds the site into `dist/`
- `npm run canon` fetches the Faleth Capital documents on their own (`dev` and `build` run it first)
- `npm run preview` serves the built site

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | Landing (portrait, links, socials), My Story, Goals, Get in touch |
| `/heroes/` | `src/pages/heroes.astro` | Team Heroes: The Journey (the path and the weekly loop) |
| `/faleth/` | `src/pages/faleth.astro` | Faleth Capital: what it is, the two buckets, the five steps, and the list of documents |
| `/faleth/<slug>/` | `src/pages/faleth/[slug].astro` | One page per Faleth Capital document (nine), built from GitHub at build time |

The top bar (`src/components/Header.astro`) is shared: HEROES on the left, the name (home) in the
centre, FALETH on the right. The current page's tab is underlined and marked `aria-current="page"`.

## Editing the text and links

**All copy and links live in one file: `src/content/site.ts`.** Components never contain wording,
so changing text means editing that file only.

- Fields marked `// PLACEHOLDER` are lorem ipsum waiting for real copy. Replace the string.
- Affiliate links: append another `{ title, description, href }` object to `landing.links`.
  `landing.affiliateNote` can be set to `''` to hide the disclosure line.
- Socials: edit `socials`. Icons are inline SVG paths in `src/components/icons.ts` (from the CC0
  `simple-icons` set); to add a network, add its path there and its id to the `SocialId` type.
- What I am working on: each entry takes an optional `link` (a URL). `null` hides it.
- Display headings above Story, Goals and Contact are optional; set `heading` to `''` to hide.
- Heroes copy is final text, including the revenue targets. Edit it only deliberately.
- Faleth page copy: the `faleth` block (mission, doors, steps, `buckets`, and so on). The *documents* are not in this file; see below.

## The Faleth Capital documents

The nine documents at `/faleth/<slug>/` are **not stored in this repo**. They are fetched from the public
GitHub repo `ThatCakeIsAPie/MainVault` (branch `main`, folder `Business/Faleth Capital`) every time the site is built.
Edit them in MainVault; never edit `.canon/` (it is gitignored and overwritten on each fetch).

**Which files are published** is an allow-list in `src/lib/canon-docs.mjs` (`CANON_FILES`, in display order;
top-level files only, never subfolders or other files). To add a document or follow a rename, edit that list.
The URL slug is the file name lower-cased and hyphenated (`The Equity Framework.md` -> `/faleth/the-equity-framework/`).

**How a build gets them** (`scripts/fetch-canon.mjs`, run by `npm run build`, `npm run dev` and `npm run canon`):

1. Asks the GitHub API for the current commit SHA of MainVault `main` (no-cache), then downloads each file from the
   SHA-pinned raw URL, so it never receives stale branch-cached content. The SHA is printed and saved in
   `.canon/meta.json` together with each file's last-commit date (shown as "Updated ..." on the pages).
2. If the SHA lookup fails it uses the `main` branch URL instead (can be a few minutes stale) and warns.
3. If GitHub is unreachable it falls back to the local vault copy (`CANON_LOCAL_FALLBACK` in `src/lib/canon-docs.mjs`,
   dates = file mtimes) and prints a loud warning. Never deploy a build made that way.
4. If neither works it exits non-zero, so the build fails instead of publishing a site with missing documents.
5. A listed file that is missing upstream (renamed or deleted) prints a loud warning naming it and the rest continue.

It sends `Authorization: Bearer $GITHUB_TOKEN` when that variable is set (CI does this) to avoid the unauthenticated
API rate limit.

**How the markdown becomes pages**: `src/lib/canon-loader.mjs` (an Astro content-collection loader, collection `canon`
in `src/content.config.ts`) reads `.canon/`, takes the first `# H1` as the title, the italic lines under it as tagline,
version line and companion line, drops the following `---`, strips `%%comments%%` and `![[embeds]]`, and turns
`[[Doc]]`, `[[Doc|alias]]`, `[[Doc#Heading]]`, `[[Doc#Heading|alias]]` and `[[#Heading]]` into links (heading matching ignores
punctuation, so `#Article VI Acquisitions` finds "Article VI: Acquisitions"). Links to anything outside the nine documents
are shown as plain text. Plugins in `src/lib/canon-plugins.mjs` shift headings so the shallowest body heading is an h2
(the page owns the only h1), give every heading a `github-slugger` id (the same function produces the link anchors) and wrap tables
for sideways scrolling. Smart punctuation is off, so the wording reaches the page exactly as written. A document with no
`# H1` (like *Beyond the Wage*) is titled from its file name.

`node scripts/check-canon-links.mjs [distDir]` checks every internal link and `#anchor` on the document pages and the
`/faleth/` index of a finished build, and fails on leftover `[[` or `%%`.

### How an edit reaches the site

1. Edit a document in MainVault and push it.
2. A workflow in the MainVault repo commits the one-line marker file `.canon-rev` (the MainVault commit SHA) to this
   repo's `main` branch. Nothing in the build reads that file; it exists so there is a commit to push.
3. That push triggers `.github/workflows/deploy.yml`, whose build runs `npm run build`, which fetches the documents fresh
   (SHA-pinned), then deploys to GitHub Pages.

The deploy workflow runs only on push to `main` and on manual **Run workflow** (Actions tab -> Deploy to GitHub Pages),
which rebuilds with the latest documents at any time. Overlapping runs queue (`concurrency`), they do not race.

## Adding a photo

1. Put the image in `src/assets/` (for example `src/assets/lyle.jpg`; roughly 4:5 portrait, at
   least 640px wide).
2. In `src/content/site.ts`, import it and set `person.photo`:

   ```ts
   import portrait from '../assets/lyle.jpg';
   // ...
   person: { /* ... */ photo: portrait, photoAlt: 'Lyle Cole smiling, outdoors' },
   ```

   Astro resizes and optimises it. While `photo` is `null` a placeholder frame is shown.

## Landing background

The stained-glass art is `public/brand/stained-glass.webp` (landscape, 2560x1600) with
`public/brand/stained-glass-portrait.webp` (1200x1900) used on narrow or portrait screens. It is
referenced by URL in `src/components/Landing.astro`; if the files are missing the landing falls back
to the plain forest-green background.

## Design notes

- Tokens (dark only) are CSS variables in `src/styles/global.css`; gold is the only accent.
- Fonts are self-hosted via `@fontsource-variable/cinzel` (headings, labels) and
  `@fontsource-variable/jost` (body). The site makes no third-party requests.
- The brand mark (`src/assets/brand/faleth-mark.svg`) is inlined once as an SVG `<symbol>` in the
  layout and reused by `src/components/Mark.astro`.

## Regenerating icons and the share image

`node scripts/make-brand-assets.mjs` rebuilds `public/favicon.svg`, `public/favicon.ico`,
`public/apple-touch-icon.png` and `public/og.png` from the mark. It needs `rsvg-convert`,
ImageMagick (`magick`) and Chromium (`BROWSER_BIN` overrides `/usr/bin/chromium`).
