# Stained-glass background generator

Procedurally draws the leaded stained-glass hero background around the Faleth mark
(`src/assets/brand/faleth-mark.svg`) and writes:

- `public/brand/stained-glass.webp` (2560x1600, landscape)
- `public/brand/stained-glass-portrait.webp` (1200x1900, phones)

## Re-run

From the repo root:

```sh
python3 scripts/stained-glass/generate.py            # both files (~25 s)
python3 scripts/stained-glass/generate.py landscape  # or: portrait
python3 scripts/stained-glass/generate.py --preview  # also writes lossless PNGs to $TMPDIR
```

Requirements: `python3` with `numpy` and `Pillow`, plus `rsvg-convert` on PATH (used to rasterise
the SVG mark). No scipy/OpenCV. Output is deterministic (fixed `SEED` in the script); change `SEED`
or the per-image `key` to get a different hand-cut layout.

## How it is built

1. Mark rasterised at target size; petal interiors found by closing the open outlines and flood-filling.
2. Field: concentric rings (geometric growth, per-ring wobble, domain-warped) crossed by radial
   spokes that converge on the point where the petal tips meet; each ring band has its own jittered
   spokes so cuts end in T-junctions like hand-cut glass.
3. Gold: Voronoi pieces seeded along the strokes plus hand-placed seeds so the star is cut into four
   facets; each piece has its own tone, gradient, streak/mottle texture.
4. Petal interiors: lighter green panes, warmer toward the centre.
5. Lead came: anti-aliased from distance fields (heavier around the mark), then a soft halation
   from the lit glass, vignette toward `#0E1C1A`, light dither, WebP (quality 92).

Palette constants are at the top of `generate.py`. Tune WebP size via the `quality` value in `main()`.
