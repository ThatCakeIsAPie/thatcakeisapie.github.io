#!/usr/bin/env python3
"""Procedural leaded stained-glass background built around the Faleth mark.

Outputs (relative to the repo root):
  public/brand/stained-glass.webp           2560x1600 landscape
  public/brand/stained-glass-portrait.webp  1200x1900 portrait

Deterministic: every random draw comes from numpy Generators seeded from SEED.
Dependencies: python3, numpy, Pillow, and `rsvg-convert` (to rasterise the SVG mark).
No scipy / opencv needed (blurs are FFT-based, flood fill is Pillow's).

Usage:  python3 scripts/stained-glass/generate.py [landscape|portrait|all] [--preview]
"""
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SEED = 20261111
ROOT = Path(__file__).resolve().parents[2]
MARK_SVG = ROOT / "src" / "assets" / "brand" / "faleth-mark.svg"
OUT_DIR = ROOT / "public" / "brand"

# ----------------------------------------------------------------------------
# palette (the site theme)
# ----------------------------------------------------------------------------


def hx(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


FIELD = [hx(c) for c in ("#0E1C1A", "#142423", "#1E3531", "#2C4A44", "#1A2E2A")]
FIELD_W = [0.14, 0.26, 0.28, 0.14, 0.18]
MOSS = hx("#3F6B50") * 0.62  # darkened moss accent pane
FIELD_CAP = hx("#2C4A44") * 1.02
EDGE = hx("#0E1C1A")
LEAD = hx("#070E0D")
LEAD_HI = hx("#16241F")
GOLD_SHADOW = hx("#8A6C2C")
GOLD_DEEP = hx("#C6A04A")
GOLD = hx("#E3C271")
GOLD_LIGHT = hx("#F1D690")
GOLD_PALE = hx("#F6E4B0")
LIME = hx("#E7DCC6")
PETAL_GREENS = [hx(c) for c in ("#2A5F4A", "#336B4F", "#28645A", "#3B7250", "#265C55", "#3C7753")]
PETAL_WARM = hx("#9DB155")

# ----------------------------------------------------------------------------
# small numeric helpers
# ----------------------------------------------------------------------------


def rng_for(*key):
    return np.random.default_rng([SEED, *key])


def gblur(a, sigma):
    """Gaussian blur through the FFT (circular; canvases have margins)."""
    a = np.asarray(a, np.float32)
    fy = np.fft.fftfreq(a.shape[0]).astype(np.float32)[:, None]
    fx = np.fft.rfftfreq(a.shape[1]).astype(np.float32)[None, :]
    g = np.exp(-2.0 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy)).astype(np.float32)
    return np.fft.irfft2(np.fft.rfft2(a) * g, s=a.shape).astype(np.float32)


_xs = np.linspace(-4.5, 4.5, 4501)
_cdf = np.array([0.5 * (1 + math.erf(v / math.sqrt(2))) for v in _xs])


def signed_distance(binary_or_alpha, sigma):
    """Approx. signed distance (px, >0 inside) from a blurred mask: d = sigma * PhiInv(blur)."""
    b = gblur(binary_or_alpha, sigma)
    b = np.clip(b, _cdf[0], _cdf[-1])
    return (np.interp(b, _cdf, _xs) * sigma).astype(np.float32)


def smooth_noise(H, W, cell_x, cell_y, rng):
    """Band-limited unit-variance noise (bicubic upsample of a random grid)."""
    gh = int(H / cell_y) + 4
    gw = int(W / cell_x) + 4
    g = rng.standard_normal((gh, gw)).astype(np.float32)
    im = Image.fromarray(g, "F").resize((int(gw * cell_x), int(gh * cell_y)), Image.Resampling.BICUBIC)
    ox = int(rng.integers(0, int(cell_x)))
    oy = int(rng.integers(0, int(cell_y)))
    a = np.asarray(im)[oy:oy + H, ox:ox + W]
    return (a / (a.std() + 1e-6)).astype(np.float32)


def fbm(H, W, rng, cells=(180, 70, 26, 10), amps=(1.0, 0.7, 0.45, 0.3)):
    out = np.zeros((H, W), np.float32)
    for c, a in zip(cells, amps):
        out += a * smooth_noise(H, W, c, c, rng)
    return out / (out.std() + 1e-6)


def streak_noise(H, W, angle_deg, rng, along=260, across=5):
    """Noise stretched along one direction (glass drawing streaks)."""
    D = int(math.hypot(H, W)) + 8
    n = smooth_noise(D, D, along, across, rng)
    im = Image.fromarray(n, "F").rotate(angle_deg, resample=Image.Resampling.BICUBIC)
    a = np.asarray(im)
    y0 = (D - H) // 2
    x0 = (D - W) // 2
    a = a[y0:y0 + H, x0:x0 + W]
    return (a / (a.std() + 1e-6)).astype(np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def softcap(c, cap):
    x = c / cap
    return cap * np.where(x < 0.8, x, 0.8 + 0.2 * np.tanh((x - 0.8) / 0.2))


# ----------------------------------------------------------------------------
# mark
# ----------------------------------------------------------------------------
MARK_VB_W, MARK_VB_H = 1549.0, 1780.0
# landmarks in coordinates of the mark rendered 1056 px high (919 px wide)
HUB = (458.0, 388.0)  # where the petal tips converge
STAR_C = (455.0, 632.0)


def render_mark(height_px):
    svg = MARK_SVG.read_text().replace("currentColor", "#ffffff")
    tmp = tempfile.mkdtemp(dir=os.environ.get("TMPDIR"))
    sp = Path(tmp) / "m.svg"
    pp = Path(tmp) / "m.png"
    sp.write_text(svg)
    subprocess.run(["rsvg-convert", "-h", str(height_px), str(sp), "-o", str(pp)], check=True)
    a = np.asarray(Image.open(pp).convert("RGBA"))[..., 3].astype(np.float32) / 255.0
    sp.unlink()
    pp.unlink()
    os.rmdir(tmp)
    return a


# ----------------------------------------------------------------------------
# polar pane cutter
# ----------------------------------------------------------------------------


def wobble_table(rng, amp):
    th = np.linspace(-np.pi, np.pi, 721)
    w = np.zeros_like(th)
    for k, a in ((1, 1.0), (2, 0.8), (3, 0.6), (5, 0.4), (8, 0.25)):
        w += a * np.sin(k * th + rng.uniform(0, 2 * np.pi))
    w = w / np.abs(w).max() * amp
    return th, w


def polar_panes(xx, yy, hub, sx, ring_r, ring_wob, band_knots):
    """Cut the plane into rose-window panes.

    xx, yy: coordinate arrays (any shape).  Rings are concentric (elliptic factor sx) with a
    per-ring angular wobble; every ring band has its own jittered set of radial cuts.
    Returns (label, distance-to-nearest-ring-line px, distance-to-nearest-spoke px).
    """
    u = (xx - hub[0]) / sx
    v = yy - hub[1]
    r = np.maximum(np.hypot(u, v), 1.0)
    th = np.arctan2(v, u)
    gr_r = np.sqrt((u / (sx * r)) ** 2 + (v / r) ** 2)
    gr_t = np.sqrt((v / sx) ** 2 + u ** 2) / (r * r)

    band = np.zeros(r.shape, np.int32)
    dring = np.full(r.shape, 1e9, np.float32)
    for r0, (tt, ww) in zip(ring_r, ring_wob):
        Ri = r0 * (1.0 + np.interp(th, tt, ww)).astype(np.float32)
        band += r >= Ri
        dring = np.minimum(dring, np.abs(r - Ri))
    dring = dring / gr_r

    lab = np.zeros(r.shape, np.int32)
    dsec = np.full(r.shape, 1e9, np.float32)
    for b in range(len(ring_r) + 1):
        sel = band == b
        if not sel.any():
            continue
        kn = band_knots[b]
        ext = np.concatenate([[kn[-1] - 2 * np.pi], kn, [kn[0] + 2 * np.pi]])
        ths = th[sel]
        j = np.searchsorted(ext, ths)
        j = np.clip(j, 1, len(ext) - 1)
        lo = ext[j - 1]
        hi = ext[j]
        dsec[sel] = np.minimum(ths - lo, hi - ths)
        lab[sel] = b * 256 + (j - 1) % len(kn)
    dsec = dsec / gr_t
    return lab, dring.astype(np.float32), dsec.astype(np.float32)


def make_band_knots(rng, n_bands, n_base, rot, drop=0.18, add=0.2):
    """Per-band jittered radial cuts; neighbouring bands share most cuts (T-junctions elsewhere).
    n_base may be an int or a list (one base count per band, no sharing then)."""
    if not isinstance(n_base, int):
        out = []
        for nb in n_base:
            step = 2 * np.pi / nb
            ks = (np.arange(nb) + rng.uniform(-0.3, 0.3, nb)) * step + rot
            out.append(np.array(sorted(((ks + np.pi) % (2 * np.pi)) - np.pi)))
        return out
    step = 2 * np.pi / n_base
    base = (np.arange(n_base) + rng.uniform(-0.28, 0.28, n_base)) * step + rot
    out = []
    for _ in range(n_bands):
        ks = [k for k in base if rng.random() > drop]
        extra = []
        for a, b in zip(base, np.r_[base[1:], base[0] + 2 * np.pi]):
            if rng.random() < add:
                extra.append(a + (b - a) * rng.uniform(0.38, 0.62))
        ks = np.array(sorted(((np.array(ks + extra) + np.pi) % (2 * np.pi)) - np.pi))
        out.append(ks)
    return out


# ----------------------------------------------------------------------------
# per-pane variation helpers (all on flattened pixel subsets)
# ----------------------------------------------------------------------------


def pane_ramps(inv, n, X, Y, rng, kind="linear", centre=None):
    """Unit-scale per-pane gradient ramps (linear along a random direction)."""
    ang = rng.uniform(0, 2 * np.pi, n)
    cs, sn = np.cos(ang)[inv], np.sin(ang)[inv]
    ramp = X * cs + Y * sn
    cnt = np.bincount(inv, minlength=n).astype(np.float64)
    mean = np.bincount(inv, ramp, n) / np.maximum(cnt, 1)
    ramp = ramp - mean[inv]
    std = np.sqrt(np.bincount(inv, ramp * ramp, n) / np.maximum(cnt, 1))
    return (ramp / np.maximum(std[inv], 1e-3)).astype(np.float32)


# ----------------------------------------------------------------------------
# main builder
# ----------------------------------------------------------------------------


def build(W, H, mark_frac, cy_frac, key, sx=1.0, preview=None):
    t_rng = rng_for(key, 0)
    Hm = int(round(H * mark_frac))
    sc = Hm / 1056.0
    am = render_mark(Hm)
    Hm_, Wm = am.shape
    ox = (W - Wm) // 2
    oy = int(round(cy_frac * H - Hm / 2))
    m = np.zeros((H, W), np.float32)
    m[oy:oy + Hm_, ox:ox + Wm] = am
    hub = (ox + HUB[0] * sc, oy + HUB[1] * sc)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    N = H * W

    # ---- mark geometry --------------------------------------------------------
    d_mark = signed_distance(m, 4.5 * max(sc, 0.8))  # >0 inside gold

    # ---- petal interiors (closing + flood fill in a crop around the mark) ------
    P = int(80 * sc)
    cy0, cy1, cx0, cx1 = oy - P, oy + Hm_ + P, ox - P, ox + Wm + P
    crop = m[cy0:cy1, cx0:cx1]
    D = gblur(crop, 20 * sc) > 0.15
    img = Image.fromarray(np.pad((D * 255).astype(np.uint8), 1)).copy()
    ImageDraw.floodfill(img, (0, 0), 128)
    holes = np.asarray(img)[1:-1, 1:-1] == 0
    himg = Image.fromarray(np.pad((holes * 255).astype(np.uint8), 1)).copy()
    for (sx_, sy_) in ((200, 450), (330, 200), (590, 200), (710, 450)):
        px_, py_ = int(sx_ * sc) + P + 1, int(sy_ * sc) + P + 1
        if himg.getpixel((px_, py_)) == 255:
            ImageDraw.floodfill(himg, (px_, py_), 128)
    hc = (np.asarray(himg)[1:-1, 1:-1] == 128).astype(np.float32)
    grown = gblur(hc, 18 * sc) > 0.10
    inter = np.zeros((H, W), bool)
    inter[cy0:cy1, cx0:cx1] = grown & (crop < 0.5)
    # forbid the downward cone between the lower petal arms (that is background)
    phi = np.degrees(np.arctan2(yy - hub[1], xx - hub[0]))
    rr = np.hypot(xx - hub[0], yy - hub[1])
    cone = (phi > 62) & (phi < 118) & (rr > 40 * sc)
    inter &= ~cone
    d_int = signed_distance(inter.astype(np.float32), 3.5 * max(sc, 0.8))  # >0 inside interior

    gold = d_mark > 0
    inside_int = (d_int > 0) & ~gold
    field = ~gold & ~inside_int

    # ---- line half widths ----------------------------------------------------------
    lw = 2.8 * max(sc, 0.82)  # lead half-width in px (about 5.6 px total on the landscape)
    near_mark = np.clip(gblur(m, 70 * sc) / 0.16, 0, 1)
    came_wob = 1.0 + 0.10 * smooth_noise(H, W, 220, 220, rng_for(key, 1))
    hw_field = lw * (1.0 + 0.55 * near_mark) * came_wob
    hw_edge = lw * 1.55
    hw_gold = lw * 1.0
    hw_int = lw * 0.95

    # ---- field panes: radiating spokes x irregular concentric rings ---------------------
    rng_f = rng_for(key, 2)
    # domain warp for hand-cut irregularity
    wx = smooth_noise(H, W, 330, 330, rng_f) * 10 * sc
    wy = smooth_noise(H, W, 330, 330, rng_f) * 10 * sc
    r_max = math.hypot(max(hub[0], W - hub[0]) / sx, max(hub[1], H - hub[1])) * 1.1
    ring_r = []
    r0 = 188 * sc
    while r0 < r_max:
        ring_r.append(r0 * rng_f.uniform(0.93, 1.07))
        r0 *= 1.30 + 0.05 * rng_f.random()
    ring_r = sorted(ring_r)
    ring_wob = [wobble_table(rng_f, 0.022) for _ in ring_r]
    knots = make_band_knots(rng_f, len(ring_r) + 1, 21, rng_f.uniform(0, 6.28))
    f_lab, f_dring, f_dspoke = polar_panes(xx + wx, yy + wy, hub, sx, ring_r, ring_wob, knots)
    e_field = np.minimum(f_dring - hw_field, f_dspoke - hw_field)
    e_field = np.where(field, e_field, 99.0).astype(np.float32)
    del wx, wy

    # ---- gold pieces ------------------------------------------------------------------
    rng_g = rng_for(key, 3)
    S = sc
    manual = [  # (x, y, tone) in mark coords: star facets, spike, stem, feet
        (425, 608, 0.97), (487, 608, 0.58), (425, 656, 0.04), (487, 656, 0.30),   # star kites
        (456, 470, 0.70),                                                          # upper spike
        (456, 738, 0.35), (456, 850, 0.62), (456, 960, 0.22),                      # stem
        (395, 905, 0.30), (320, 1018, 0.78), (517, 905, 0.55), (592, 1018, 0.18),  # feet
        (300, 636, 0.60), (612, 636, 0.34),                                        # star arms
    ]
    seeds = [(ox + x * S, oy + y * S) for x, y, _ in manual]
    tones = [t for _, _, t in manual]
    mask_pts = np.argwhere(m > 0.9)
    pool = mask_pts[(mask_pts[:, 0] < oy + 590 * S) | (np.abs(mask_pts[:, 1] - (ox + 455 * S)) > 270 * S)]
    # keep petal rim only above y<605 (rest is star)
    pool = pool[~((pool[:, 0] > oy + 395 * S) & (np.abs(pool[:, 1] - (ox + 455 * S)) < 70 * S))]
    order = rng_g.permutation(len(pool))
    dmin = 84 * S
    for k in order:
        py_, px_ = pool[k]
        if all((px_ - a) ** 2 + (py_ - b) ** 2 >= dmin * dmin for a, b in seeds):
            seeds.append((float(px_), float(py_)))
            tones.append(float(np.clip(rng_g.beta(1.5, 1.7), 0.03, 0.98)))
    seeds = np.array(seeds, np.float32)
    tones = np.array(tones, np.float32)
    gidx = np.flatnonzero((gblur(m, 2.0) > 0.004).ravel())
    gx = (gidx % W).astype(np.float32)
    gy = (gidx // W).astype(np.float32)
    dd = (gx[:, None] - seeds[None, :, 0]) ** 2 + (gy[:, None] - seeds[None, :, 1]) ** 2
    o2 = np.argsort(dd, axis=1)[:, :2]
    d1 = np.take_along_axis(dd, o2[:, :1], 1)[:, 0]
    d2 = np.take_along_axis(dd, o2[:, 1:2], 1)[:, 0]
    s1 = seeds[o2[:, 0]]
    s2 = seeds[o2[:, 1]]
    sep = np.hypot(s1[:, 0] - s2[:, 0], s1[:, 1] - s2[:, 1])
    dbis = (d2 - d1) / (2 * np.maximum(sep, 1e-3))
    g_lab_full = np.zeros(N, np.int32)
    g_dline_full = np.full(N, 99.0, np.float32)
    g_lab_full[gidx] = o2[:, 0] + 1
    g_dline_full[gidx] = dbis
    del dd
    e_gold = (g_dline_full.reshape(H, W) - hw_gold)
    e_gold = np.where(gold, e_gold, 99.0).astype(np.float32)

    # ---- petal interior panes -----------------------------------------------------------
    rng_i = rng_for(key, 4)
    i_ring = [r * sc * rng_i.uniform(0.94, 1.06) for r in (200, 330, 450)]
    i_wob = [wobble_table(rng_i, 0.11) for _ in i_ring]
    i_knots = make_band_knots(rng_i, len(i_ring) + 1, [5, 8, 10, 12], rng_i.uniform(0, 6.28))
    i_lab, i_dring, i_dsp = polar_panes(xx, yy, hub, 1.0, i_ring, i_wob, i_knots)
    e_int_lines = np.minimum(i_dring, i_dsp) - hw_int
    e_int_lines = np.where(inside_int, e_int_lines, 99.0).astype(np.float32)

    # ---- lead network -----------------------------------------------------------------
    e_edge = np.abs(d_mark) - hw_edge  # around the mark
    e_inb = np.where(gold, 99.0, np.abs(d_int) - hw_int)  # interior boundary (hub openings)
    e_all = np.minimum.reduce([e_field, e_gold, e_int_lines, e_edge, e_inb])
    lead_a = np.clip(0.5 - e_all, 0, 1).astype(np.float32)
    del e_field, e_gold, e_int_lines, e_inb

    # ---- textures ---------------------------------------------------------------------
    rng_t = rng_for(key, 5)
    mot = fbm(H, W, rng_t)
    streaks = [streak_noise(H, W, a, rng_t) for a in (0, 45, 90, 135)]
    sheen = smooth_noise(H, W, 700, 700, rng_t)

    col = np.zeros((N, 3), np.float32)
    tex_full = np.ones((N, 1), np.float32)  # field glass texture, kept alive under the vignette
    shade_d = np.maximum(e_all, 0).ravel()
    mot_f = mot.ravel()
    sheen_f = sheen.ravel()
    X_f = xx.ravel()
    Y_f = yy.ravel()
    hub_d = np.hypot(xx - hub[0], yy - (hub[1] + 90 * sc)).ravel()

    def region(sel, lab, kind):
        idx = np.flatnonzero(sel.ravel())
        uq, inv = np.unique(lab.ravel()[idx], return_inverse=True)
        n = len(uq)
        rg = rng_for(key, {"field": 10, "gold": 11, "int": 12}[kind])
        X = X_f[idx]
        Y = Y_f[idx]
        ramp = pane_ramps(inv, n, X, Y, rg)
        ramp2 = pane_ramps(inv, n, X, Y, rg)
        sdir = rg.integers(0, 4, n)[inv]
        sflat = np.stack([s.ravel()[idx] for s in streaks], 0)
        stk = np.take_along_axis(sflat, sdir[None, :], 0)[0]
        samp = rg.uniform(0.3, 1.0, n)[inv]
        gamp = rg.uniform(0.4, 1.0, n)[inv]
        mt = mot_f[idx]
        return idx, inv, n, rg, ramp, ramp2, stk, samp, gamp, mt

    # field glass
    idx, inv, n, rg, ramp, ramp2, stk, samp, gamp, mt = region(field, f_lab, "field")
    pal = np.array(FIELD + [MOSS], np.float32)
    w = np.array(FIELD_W + [0.10], np.float32)
    w /= w.sum()
    pick = rg.choice(len(pal), n, p=w)
    base = pal[pick].copy()
    base *= rg.uniform(0.88, 1.12, (n, 1)).astype(np.float32)
    base += rg.normal(0, 0.006, (n, 3)).astype(np.float32) * np.array([0.6, 1.0, 0.9], np.float32)
    c = base[inv]
    near = np.exp(-(hub_d[idx] / (700 * sc)) ** 2)[:, None]
    c = c * (1.0 + 0.40 * near)
    mod = 1.0 + 0.16 * gamp[:, None] * ramp[:, None] + 0.05 * mt[:, None] + 0.07 * samp[:, None] * stk[:, None]
    c = c * mod
    pane_f = rg.uniform(0.82, 1.22, n).astype(np.float32)[inv][:, None]
    tex_full[idx] = np.clip((1.0 + 0.5 * (mod - 1.0)) * pane_f, 0.6, 1.5)
    # soft bloom from the centre
    gl = np.exp(-(hub_d[idx] / (560 * sc)) ** 2)[:, None]
    c = c + gl * np.array([0.065, 0.080, 0.040], np.float32) * (0.7 + 0.3 * mt[:, None])
    c = c * (1 - 0.30 * np.exp(-shade_d[idx] / (9 * sc)))[:, None]
    c = softcap(np.maximum(c, 0), FIELD_CAP)
    col[idx] = c

    # petal interiors: lit from behind, warmer toward the hub
    idx, inv, n, rg, ramp, ramp2, stk, samp, gamp, mt = region(inside_int, i_lab, "int")
    pal = np.array(PETAL_GREENS, np.float32)
    base = pal[rg.integers(0, len(pal), n)] * rg.uniform(0.88, 1.22, (n, 1)).astype(np.float32)
    pwarm = rg.uniform(0.0, 0.30, n).astype(np.float32)
    base = base * (1 - pwarm[:, None]) + PETAL_WARM * 0.8 * pwarm[:, None]
    c = base[inv]
    hd = np.hypot(X_f[idx] - hub[0], Y_f[idx] - hub[1]) / sc
    warm = np.exp(-(hd / 235.0) ** 2)[:, None]
    core = 1 - np.exp(-shade_d[idx] / (24 * sc))  # glass is luminous in the middle of a pane
    mod = 1.0 + 0.27 * gamp[:, None] * ramp[:, None] + 0.07 * mt[:, None] + 0.10 * samp[:, None] * stk[:, None]
    mod = mod + 0.30 * np.exp(-(hd / 420.0) ** 1.5)[:, None] + 0.16 * core[:, None]
    c = c * mod
    c = c * (1 - warm * 0.50) + PETAL_WARM * warm * 0.50 * (1.0 + 0.1 * mt[:, None])
    c = c * (1 - 0.45 * np.exp(-shade_d[idx] / (9 * sc)))[:, None]
    col[idx] = np.clip(c, 0, 1)

    # gold glass
    idx, inv, n, rg, ramp, ramp2, stk, samp, gamp, mt = region(gold, g_lab_full.reshape(H, W), "gold")
    lab_ids = np.unique(g_lab_full[idx])  # sorted; region() used the same unique order
    ptone = tones[lab_ids - 1]
    ptone = np.clip(ptone + rg.normal(0, 0.05, n), 0, 1)
    t = ptone[inv][:, None]
    deep = GOLD_SHADOW * 0.45 + GOLD_DEEP * 0.55
    gcol = np.where(
        t < 0.45,
        deep + (GOLD_DEEP - deep) * (t / 0.45),
        np.where(t < 0.82, GOLD_DEEP + (GOLD - GOLD_DEEP) * ((t - 0.45) / 0.37), GOLD + (GOLD_LIGHT - GOLD) * ((t - 0.82) / 0.18)),
    )
    core = 1 - np.exp(-shade_d[idx] / (16 * sc))
    mod = 1.0 + 0.26 * gamp[:, None] * ramp[:, None] + 0.05 * mt[:, None] + 0.10 * samp[:, None] * stk[:, None]
    mod = mod + 0.10 * core[:, None]
    hue = rg.uniform(-1, 1, n).astype(np.float32)[inv][:, None]  # amber <-> pale lemon per piece
    gcol = gcol * (1 + 0.07 * hue * np.array([1.0, 0.0, -1.2], np.float32))
    gcol = gcol * np.array([1.0, 0.985, 0.90], np.float32)  # a touch richer / less pale
    c = gcol * mod * 0.99
    # deeper amber gold toward the rim of each piece; broad soft sheen
    edge = np.exp(-shade_d[idx] / (12 * sc))[:, None]
    c = c * (1 - 0.27 * edge) + GOLD_SHADOW * 0.27 * edge * 0.7
    c = c * (1.0 + 0.08 * np.tanh(sheen_f[idx])[:, None])
    c = np.minimum(c, GOLD_PALE * 0.97)
    col[idx] = np.clip(c, 0, 1)
    del streaks, mot, sheen

    # ---- vignette (pulls the outer area to the edge colour) -----------------------------
    cx_, cy_ = W / 2.0, H / 2.0
    tn = np.sqrt(((xx - cx_) / (W / 2.0)) ** 2 + ((yy - cy_) / (H / 2.0)) ** 2)
    vw = smoothstep(0.34, 1.0, tn).ravel()
    is_field = field.ravel()
    amount = np.where(is_field, 0.90, 0.45) * vw
    amount = amount[:, None]
    col = col * (1 - amount) + EDGE * tex_full * amount
    col = col * (1 - 0.22 * (vw * (1 - is_field))[:, None])

    # ---- lead on top --------------------------------------------------------------------
    la = lead_a.ravel()[:, None]
    prof = np.clip(1 + e_all.ravel() / 3.0, 0, 1)  # 0 at the rim .. 1 at the core of a lead line
    lead_col = LEAD + (LEAD_HI - LEAD) * (0.45 * prof[:, None] ** 2) * (0.7 + 0.3 * np.tanh(sheen_f)[:, None])
    lead_col = lead_col * (1 - 0.5 * vw[:, None])
    col = col * (1 - la) + lead_col * la

    # ---- halation: backlit glass spills a little light over neighbouring lead/glass ------
    lum_src = np.zeros((H, W, 3), np.float32)
    emit = (gold | inside_int)
    lum_src[emit] = col.reshape(H, W, 3)[emit]
    lum_src[inside_int] *= 0.8
    halo = np.zeros((H, W, 3), np.float32)
    for ch in range(3):
        halo[..., ch] = 0.55 * gblur(lum_src[..., ch], 22 * sc) + 0.45 * gblur(lum_src[..., ch], 85 * sc)
    spill = (~emit).astype(np.float32)[..., None]
    col = col + (halo * spill * 0.30).reshape(N, 3)
    fm = field.ravel()
    col[fm] = softcap(col[fm], FIELD_CAP * 1.12)

    # ---- finish: mild grain dither, quantise ------------------------------------------
    gr = rng_for(key, 9)
    col += gr.normal(0, 0.9 / 255.0, (N, 1)).astype(np.float32)
    out = np.clip(col * 255.0 + 0.5, 0, 255).astype(np.uint8).reshape(H, W, 3)
    return Image.fromarray(out), dict(hub=hub, sc=sc, field=field, col=col.reshape(H, W, 3))


def main():
    np.seterr(divide="ignore", invalid="ignore")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    which = args[0] if args else "all"
    preview = "--preview" in sys.argv  # also dump lossless PNGs into $TMPDIR
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    jobs = []
    if which in ("all", "landscape"):
        jobs.append(("stained-glass.webp", dict(W=2560, H=1600, mark_frac=0.66, cy_frac=0.50, key=1, sx=1.12), 92))
    if which in ("all", "portrait"):
        jobs.append(("stained-glass-portrait.webp", dict(W=1200, H=1900, mark_frac=0.47, cy_frac=0.47, key=2, sx=1.0), 92))
    for name, kw, q in jobs:
        im, info = build(**kw)
        if preview:
            tmpd = Path(os.environ.get("TMPDIR", "."))
            im.save(tmpd / (name.replace(".webp", "") + "_preview.png"))
        path = OUT_DIR / name
        im.save(path, "WEBP", quality=q, method=6)
        f = info["field"]
        c = info["col"][f]
        mx = (c.max(axis=0) * 255).round().astype(int)
        print(f"{path}  {im.size}  {path.stat().st_size} bytes  field max RGB {tuple(mx)}")


if __name__ == "__main__":
    main()
