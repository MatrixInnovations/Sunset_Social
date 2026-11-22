/**
 * Sunset Social · motion tokens (mobile).
 * Single source of truth for every duration, curve, distance and colour used by motion.
 * Tone matches the web entrance (motion/entrance): one calm "expo-out" curve, long soft
 * fades, short distances. If a number is not here, it should not be animated.
 */
import { Easing, ReduceMotion } from 'react-native-reanimated';

/* ── Curves ─────────────────────────────────────────────────────────────── */
/** Exact cubic-bezier values. `bez` is the raw tuple (for docs / CSS previews). */
export const bez = {
  /** Primary enter curve. Same as web `--sse-ease`. Fast start, long silky settle. */
  out: [0.22, 1, 0.36, 1],
  /** Exits / dismissals (ease-in cubic). Used sparingly; exits are shorter than enters. */
  in: [0.32, 0, 0.67, 0],
  /** Sweeps that travel across an element (shimmer, foil sheen). ease-in-out cubic. */
  inOut: [0.65, 0, 0.35, 1],
  /** Light / glow fades (sine in-out). Matches GSAP `sine.inOut` on web. */
  soft: [0.37, 0, 0.63, 1],
  /** Press-in on buttons (ease-out quad). */
  press: [0.5, 1, 0.89, 1],
} as const;

export const ease = {
  out: Easing.bezier(...bez.out),
  in: Easing.bezier(...bez.in),
  inOut: Easing.bezier(...bez.inOut),
  soft: Easing.bezier(...bez.soft),
  press: Easing.bezier(...bez.press),
} as const;

/**
 * Plain (x)=>y worklet curves, for code that evaluates easing itself on a master clock
 * (GoldenTicketReveal). `ease.*` are Reanimated factories for withTiming; `curve.*` are functions.
 */
export const curve = {
  out: Easing.bezierFn(...bez.out),
  in: Easing.bezierFn(...bez.in),
  inOut: Easing.bezierFn(...bez.inOut),
  soft: Easing.bezierFn(...bez.soft),
} as const;

/* ── Durations (ms) ─────────────────────────────────────────────────────── */
export const dur = {
  pressIn: 110,
  micro: 180, // tab label/colour cross-fades, chip toggles
  short: 240, // modal backdrop, small fades
  base: 320, // most fades; stack push content
  enter: 420, // element rise-in on screen enter
  screen: 360, // stack fade transition (iOS animationDuration)
  slow: 640, // ticket rise, hero settle
  sweep: 1400, // Reserve button shimmer pass
  foil: 600, // ticket foil sheen pass
  skeleton: 1300, // skeleton highlight pass (+ skeletonGap pause)
  skeletonGap: 350,
} as const;

/* ── Stagger ────────────────────────────────────────────────────────────── */
export const stagger = {
  /** Gap between sibling blocks on a screen (eyebrow → title → lede → cards). */
  block: 60,
  /** Gap between list items (guest wall, ticket list). */
  list: 45,
  /** Only the first N items animate; the rest appear at once. Caps total stagger at ~315 ms. */
  listMaxAnimated: 8,
  /** Delay before the first block animates after the screen transition starts. */
  lead: 80,
} as const;

/* ── Distances (pt) ─────────────────────────────────────────────────────── */
export const dist = {
  rise: 12, // block rise on enter
  listRise: 10,
  tabRise: 6,
  ticketRise: 48,
} as const;

/* ── Springs (only for press release; everything else is timed) ────────── */
/** Damping ratio ≈ 0.73: settles with < 1 % overshoot on a 0.97 → 1 scale. Feels firm, not bouncy. */
export const pressSpring = { damping: 26, stiffness: 320, mass: 1 } as const;

/* ── Scale values ───────────────────────────────────────────────────────── */
export const scale = {
  pressed: 0.97,
  cardPressed: 0.985,
} as const;

/* ── Colour (from mockups/src/base.css) ─────────────────────────────────── */
export const color = {
  ink: '#0B0A0C',
  mid950: '#050406',
  ivory: '#F4ECDD',
  ivory400: '#A89F91',
  gold: '#C9A96E',
  gold300: '#E6D3A3',
  goldBright: '#E3C16F',
  gold600: '#B8914F',
  gold700: '#9E7F46',
  amber: '#E08A3C',
  amber400: '#F2A65A',
  btnText: '#1A1206',
  burg: '#5A1424',
} as const;

/** Gradients as [colors, locations] so they plug straight into <LinearGradient>. */
export const gradients = {
  /** Gold Reserve button fill. Mockup: linear-gradient(180deg, …). Top → bottom. */
  reserveFill: {
    colors: ['#F2D8A0', '#E3C16F', '#C9A96E', '#B8914F'],
    locations: [0, 0.35, 0.7, 1],
  },
  /** Golden-hour shimmer band (rides on top of reserveFill). Warm white, never pure white. */
  reserveShimmer: {
    colors: ['#FFF3D600', '#FFF3D61F', '#FFF8E88C', '#FFF3D61F', '#FFF3D600'],
    locations: [0, 0.3, 0.5, 0.7, 1],
  },
  /** Disabled Reserve: flat, low-contrast gold glass. No glow, no shimmer. */
  reserveDisabled: {
    colors: ['#2A2318', '#221C14'],
    locations: [0, 1],
  },
  /** Golden ticket foil. Mockup: linear-gradient(135deg, …). */
  ticketFoil: {
    colors: ['#F6E2B0', '#E3C16F', '#C9A96E', '#F2D8A0', '#B8914F', '#E6CF98'],
    locations: [0, 0.22, 0.45, 0.62, 0.82, 1],
  },
  /** Ticket sheen band. Mockup ::before: 115deg, transparent 30 %, rgba(255,255,255,.45) 42 %, transparent 54 %. */
  ticketSheen: {
    colors: ['#FFFFFF00', '#FFFFFF73', '#FFFFFF00'],
    locations: [0, 0.5, 1],
  },
  /** Skeleton bone + highlight. */
  skeletonBase: 'rgba(255,240,215,0.06)',
  skeletonHighlight: {
    colors: ['#FFF0D700', '#FFF0D714', '#FFF0D700'],
    locations: [0, 0.5, 1],
  },
} as const;

/* ── Reduce-motion policy helpers ───────────────────────────────────────── */
/**
 * Reanimated ≥ 3.5 defaults every animation to ReduceMotion.System, which SKIPS it to the end
 * when the OS setting is on. Opacity-only fades are allowed under reduced motion in this spec,
 * so they opt out explicitly with `fadeCfg`. Movement (translate/scale/rotate) keeps System.
 */
export const fadeCfg = (duration: number = dur.base) => ({
  duration,
  easing: ease.soft,
  reduceMotion: ReduceMotion.Never,
});
export const moveCfg = (duration: number = dur.enter) => ({
  duration,
  easing: ease.out,
  reduceMotion: ReduceMotion.System,
});

/* ── Navigation presets (Expo Router / native-stack options) ───────────── */
export const stackScreen = {
  /** Default push (incl. Discover → Event): native platform transition. Keeps the iOS edge-swipe
   *  back gesture exact and costs nothing on the JS/UI threads. The hero settle + block stagger
   *  inside the screen supply the "luxury" feel. */
  default: { animation: 'default' as const },
  /** Optional softer push for Discover → Event if Andrew prefers it (open question in spec §1).
   *  iOS honours animationDuration; Android uses the system fade length. */
  eventSoft: { animation: 'fade' as const, animationDuration: dur.screen },
  /** Checkout: native sheet / modal. */
  checkout: { presentation: 'modal' as const, animation: 'slide_from_bottom' as const },
  /** Golden-ticket reveal replaces checkout. Opaque card, fade only. */
  ticketReveal: {
    presentation: 'card' as const,
    animation: 'fade' as const,
    animationDuration: dur.short,
    gestureEnabled: false,
  },
};
