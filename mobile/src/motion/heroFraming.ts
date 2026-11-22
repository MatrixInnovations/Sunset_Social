/**
 * Hero crop math: keeps a photo's "safe zone" (e.g. all five hands + glasses) uncropped
 * at every phone width AND at the hero's max parallax scale.
 * Pure functions, no React. Unit-testable (see MOTION-SPEC §4.3 for test cases).
 */

/** Normalised rect in image space (0..1). */
export type NRect = { x0: number; y0: number; x1: number; y1: number };
export type HeroArt = {
  width: number; // source px
  height: number;
  safe: NRect; // must stay fully visible
  focal: { x: number; y: number }; // point kept at the container centre (default: safe centre)
};

/** Max scale the hero ever reaches (iOS pull-down bounce cap). Scroll push-in peaks at 1.04. */
export const HERO_MAX_SCALE = 1.06;
/** Breathing room added around the safe zone on every side (fraction of the image). */
export const SAFE_MARGIN = 0.02;

/**
 * Event I · "sunset-toast.jpg" (1152×864): five hands toasting into the sunset.
 * Measured on a 48 px grid. Safe zone = glass rims (top, y≈160 px) → lowest glass foot /
 * bracelets (y≈735 px); left fist (x≈96 px) → right hand knuckles (x≈1100 px).
 * Sleeves below y≈735 and sky above y≈160 are free to crop.
 */
export const HERO_ART = {
  sunsetToast: {
    width: 1152,
    height: 864,
    safe: { x0: 0.083, y0: 0.181, x1: 0.955, y1: 0.852 },
    focal: { x: 0.519, y: 0.516 },
  },
} satisfies Record<string, HeroArt>;

/**
 * Allowed hero heights for a container width so the safe zone survives `maxScale`.
 * Height-bound cover (W/H ≤ A):  visible width  = (W/H)/(A·s)  ≥ safeW → H ≤ W/(A·s·safeW)
 * Width-bound cover  (W/H >  A):  visible height = A/((W/H)·s) ≥ safeH → H ≥ W·s·safeH/A
 */
export function heroHeightRange(W: number, art: HeroArt, maxScale = HERO_MAX_SCALE, margin = SAFE_MARGIN) {
  const A = art.width / art.height;
  const sw = Math.min(1, art.safe.x1 - art.safe.x0 + 2 * margin);
  const sh = Math.min(1, art.safe.y1 - art.safe.y0 + 2 * margin);
  return { min: (W * maxScale * sh) / A, max: W / (A * maxScale * sw) };
}

/** The design height (mockup: 340) clamped into the safe range. Event I @ 390 pt → 302 pt. */
export function heroHeightFor(W: number, art: HeroArt, designHeight = 340) {
  const r = heroHeightRange(W, art);
  if (designHeight > r.max) return Math.floor(r.max);
  if (designHeight < r.min) return Math.ceil(r.min);
  return Math.round(designHeight);
}

/** Cover-fit frame (absolute layout for the <Image>) with the focal point centred, clamped to cover. */
export function coverFrame(W: number, H: number, art: HeroArt) {
  const k = Math.max(W / art.width, H / art.height);
  const width = art.width * k;
  const height = art.height * k;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const left = clamp(W / 2 - art.focal.x * width, W - width, 0);
  const top = clamp(H / 2 - art.focal.y * height, H - height, 0);
  return { width, height, left, top };
}

/** True if the safe zone is fully inside the container when the image is scaled by `s` about the container centre. */
export function safeZoneVisible(W: number, H: number, art: HeroArt, s = HERO_MAX_SCALE) {
  const f = coverFrame(W, H, art);
  const toX = (nx: number) => W / 2 + (f.left + nx * f.width - W / 2) * s;
  const toY = (ny: number) => H / 2 + (f.top + ny * f.height - H / 2) * s;
  const e = 0.5; // half-pt tolerance
  return (
    toX(art.safe.x0) >= -e && toX(art.safe.x1) <= W + e && toY(art.safe.y0) >= -e && toY(art.safe.y1) <= H + e
  );
}
