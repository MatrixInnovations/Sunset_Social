/**
 * ParallaxHero — scroll-driven parallax for event heroes (Event page + Discover card art).
 *
 * Scroll down (y ≥ 0):
 *   image translateY = y × 0.35, capped at min(0.35·H, 110 pt)   → lags behind the page
 *   image scale      = 1 → 1.04 over y ∈ [0, H]                  → slow push-in
 *   dim veil         = 0 → 0.35 ink over y ∈ [0, 0.6·H]          → hero recedes as you read
 * Pull down (iOS bounce, y < 0):
 *   scale = min(1.06, 1 + |y|/H); top edge stays pinned to the screen top. Past the cap the
 *   bottom lifts into the ink shade (invisible seam) instead of over-zooming the hands.
 * Enter: hero settles from scale 1.03 → 1 over 640 ms (out curve) when the screen mounts.
 * Reduce motion: image is static (no translate/scale/settle). Veil still follows scroll
 *   (opacity-only), so the page reads the same.
 *
 * Text never parallaxes; only the photo layer moves. All math runs in one worklet per frame.
 */
import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, dur, ease } from './motion';
import { coverFrame, HERO_MAX_SCALE, HeroArt, heroHeightFor, safeZoneVisible } from './heroFraming';
import { useMotionPrefs } from './useMotionPrefs';

export const PARALLAX = {
  speed: 0.35,
  maxOffsetPt: 110,
  pushInScale: 1.04,
  bounceMaxScale: HERO_MAX_SCALE,
  enterFromScale: 1.03,
  veilMax: 0.35,
} as const;

/** Shared scroll value + UI-thread handler. Attach to an Animated.ScrollView / Animated.FlatList. */
export function useHeroScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { scrollY, onScroll };
}

/** Event I shade: mockup shade, but the mid stop is pushed down (55 % → 74 %) so the hands stay bright. */
export const SHADE_EVENT_I = {
  colors: ['#0B0A0C8C', '#0B0A0C00', '#0B0A0C00', '#0B0A0CB3', '#0B0A0C'],
  locations: [0, 0.28, 0.74, 0.92, 1],
};

type Props = {
  source: ImageSource | number;
  art: HeroArt;
  scrollY: SharedValue<number>;
  /** Mockup height; clamped into the safe range for this art (Event I @ 390 pt → 302). */
  designHeight?: number;
  /** Width of the hero (defaults to window width; pass the card width for the Discover card). */
  width?: number;
  shade?: { colors: string[]; locations: number[] };
  /** Set false for heroes inside a card that does not scroll with the page (Discover carousel). */
  parallax?: boolean;
  children?: ReactNode; // overlay content (badges, back/share buttons)
};

export function ParallaxHero({
  source,
  art,
  scrollY,
  designHeight = 340,
  width,
  shade = SHADE_EVENT_I,
  parallax = true,
  children,
}: Props) {
  const { reduceMotion } = useMotionPrefs();
  const win = useWindowDimensions();
  const W = width ?? win.width;
  const H = heroHeightFor(W, art, designHeight);
  const frame = coverFrame(W, H, art);
  const maxOffset = Math.min(H * PARALLAX.speed, PARALLAX.maxOffsetPt);

  if (__DEV__ && !safeZoneVisible(W, H, art)) {
    console.warn(`[ParallaxHero] safe zone would crop at W=${W} H=${H}. Check HERO_ART / designHeight.`);
  }

  const settle = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) settle.value = withTiming(1, { duration: dur.slow, easing: ease.out });
  }, [reduceMotion, settle]);

  const imageStyle = useAnimatedStyle(() => {
    if (reduceMotion || !parallax) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.value;
    const enter = PARALLAX.enterFromScale + (1 - PARALLAX.enterFromScale) * settle.value;
    if (y < 0) {
      const s = Math.min(PARALLAX.bounceMaxScale, 1 + -y / H);
      return { transform: [{ translateY: y + ((s - 1) * H) / 2 }, { scale: s * enter }] };
    }
    const ty = Math.min(y * PARALLAX.speed, maxOffset);
    const s = interpolate(y, [0, H], [1, PARALLAX.pushInScale], Extrapolation.CLAMP);
    return { transform: [{ translateY: ty }, { scale: s * enter }] };
  });

  const veilStyle = useAnimatedStyle(() => ({
    opacity: parallax
      ? interpolate(scrollY.value, [0, 0.6 * H], [0, PARALLAX.veilMax], Extrapolation.CLAMP)
      : 0,
  }));

  return (
    <View style={{ width: W, height: H, overflow: 'hidden', backgroundColor: color.ink }}>
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <Image
          source={source}
          style={{ position: 'absolute', left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
          contentFit="fill" // frame already has the image's aspect ratio
          cachePolicy="memory-disk"
          transition={0} // the screen transition already fades; don't double-fade
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={shade.colors as [string, string, ...string[]]}
        locations={shade.locations as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.ink }, veilStyle]} />
      {children}
    </View>
  );
}

/** Compact header that fades in as the hero leaves (back / title / share on solid ink). */
export function useHeaderFade(scrollY: SharedValue<number>, heroHeight: number) {
  return useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroHeight - 120, heroHeight - 60], [0, 1], Extrapolation.CLAMP),
  }));
}
