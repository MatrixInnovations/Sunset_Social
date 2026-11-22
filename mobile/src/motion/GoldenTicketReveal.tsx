/**
 * GoldenTicketReveal — the "you're in" moment after a successful reservation.
 * One master clock (t: 0 → 1600 ms, linear) drives every layer through eased windows,
 * so the whole sequence is a single UI-thread animation and can be skipped in one write.
 *
 *   t (ms)        layer                     what happens                               curve
 *   0 –  280      backdrop                  ink 0 → 0.78                                soft
 *   0 –  600      warm glow                 opacity 0 → 1, scale 0.90 → 1               soft
 *   120 –  760    ticket                    y +48 → 0, scale 0.94 → 1, rotX 18° → 4°    out
 *   120 –  420    ticket                    opacity 0 → 1                               soft
 *   700           haptic                    notification Success                        —
 *   760 – 1360    foil sheen                band crosses ticket left → right, once      inOut
 *   820 – 1400    particles (optional)      12 gold motes rise 24–40 pt and fade        out
 *   980 – 1280    QR                        opacity 0 → 1, scale 0.98 → 1               out
 *   1240 – 1600   header + actions          opacity 0 → 1, y +8 → 0 (actions +80 ms)    out
 *   1600          onDone                    total 1.6 s (< 1.8 s budget)
 *
 * Tap anywhere → jumps to the final frame (haptic fires if it has not yet).
 * Reduce motion: backdrop + everything fades in together over 260 ms. No movement, no sheen,
 * no particles. The success haptic still fires (it is feedback, not motion).
 */
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, curve, gradients } from './motion';
import { haptic } from './haptics';
import { useMotionPrefs } from './useMotionPrefs';

export const REVEAL_TOTAL_MS = 1600;
const REDUCED_TOTAL_MS = 300;
const HAPTIC_AT = 700;

/** Eased 0..1 progress of `t` inside [start, end]. */
function seg(t: number, start: number, end: number, ease: (x: number) => number) {
  'worklet';
  const p = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return ease(p);
}

type Ctx = { t: SharedValue<number>; reduced: boolean };
const RevealCtx = createContext<Ctx | null>(null);

/** Wrap the ticket's QR block in this so it develops after the ticket lands. */
export function QrReveal({ children }: { children: ReactNode }) {
  const ctx = useContext(RevealCtx);
  const style = useAnimatedStyle(() => {
    if (!ctx) return {};
    if (ctx.reduced) return { opacity: seg(ctx.t.value, 0, REDUCED_TOTAL_MS, curve.soft) };
    const p = seg(ctx.t.value, 980, 1280, curve.out);
    return { opacity: p, transform: [{ scale: 0.98 + 0.02 * p }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

type Props = {
  /** The existing golden ticket card (same component as the Tickets tab). Wrap its QR in <QrReveal>. */
  ticket: ReactNode;
  /** "You're on the list" heading, above the ticket. */
  header?: ReactNode;
  /** Add to Apple Wallet / Transfer / Directions row, below the ticket. */
  actions?: ReactNode;
  /** Optional gold motes. Default on; turn off for low-end Android (see spec §7). */
  particles?: boolean;
  onDone?: () => void;
};

export function GoldenTicketReveal({ ticket, header, actions, particles = true, onDone }: Props) {
  const { reduceMotion } = useMotionPrefs();
  const { width } = useWindowDimensions();
  const t = useSharedValue(0);
  const hapticFired = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const total = reduceMotion ? REDUCED_TOTAL_MS : REVEAL_TOTAL_MS;

  const fireHaptic = () => {
    if (hapticFired.current) return;
    hapticFired.current = true;
    haptic.success();
  };

  useEffect(() => {
    const handles: ReturnType<typeof setTimeout>[] = [];
    AccessibilityInfo.announceForAccessibility?.("You're on the list. See you at golden hour.");
    t.value = withTiming(total, { duration: total, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    handles.push(setTimeout(fireHaptic, reduceMotion ? 200 : HAPTIC_AT));
    handles.push(setTimeout(() => onDone?.(), total));
    timers.current = handles;
    return () => handles.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (t.value >= total) return;
    timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/immutability
    t.value = total;
    fireHaptic();
    onDone?.();
  };

  const backdrop = useAnimatedStyle(() => ({
    opacity: 0.78 * seg(t.value, 0, reduceMotion ? 200 : 280, curve.soft),
  }));

  const glow = useAnimatedStyle(() => {
    const p = seg(t.value, 0, reduceMotion ? 260 : 600, curve.soft);
    return reduceMotion ? { opacity: p } : { opacity: p, transform: [{ scale: 0.9 + 0.1 * p }] };
  });

  const ticketStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: seg(t.value, 0, REDUCED_TOTAL_MS, curve.soft), transform: [{ perspective: 900 }, { rotateX: '4deg' }] };
    const m = seg(t.value, 120, 760, curve.out);
    return {
      opacity: seg(t.value, 120, 420, curve.soft),
      transform: [
        { perspective: 900 },
        { translateY: 48 * (1 - m) },
        { rotateX: `${18 - 14 * m}deg` }, // settles on the mockup's resting 4° tilt
        { scale: 0.94 + 0.06 * m },
      ],
    };
  });

  const ticketW = width - 68; // mockup: 34 pt side margins
  const sheenW = ticketW * 0.24;
  const sheen = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    const p = seg(t.value, 760, 1360, curve.inOut);
    const visible = t.value > 760 && t.value < 1360 ? 1 : 0; // zero overdraw outside the pass
    return {
      opacity: visible,
      transform: [{ translateX: interpolate(p, [0, 1], [-sheenW * 1.5, ticketW + sheenW * 0.5]) }, { rotate: '25deg' }],
    };
  });

  const headerStyle = useFadeUp(t, reduceMotion, 1240);
  const actionsStyle = useFadeUp(t, reduceMotion, 1320);

  const ctx = useMemo(() => ({ t, reduced: reduceMotion }), [t, reduceMotion]);

  return (
    <RevealCtx.Provider value={ctx}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessible={false}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.ink }, backdrop]} />
        <Animated.View pointerEvents="none" style={[styles.glow, glow]} />
        <View style={styles.column}>
          <Animated.View style={headerStyle}>{header}</Animated.View>
          <Animated.View style={[styles.ticketWrap, { width: ticketW }, ticketStyle]} accessible accessibilityLabel="Golden ticket">
            <View style={styles.ticketClip}>
              {ticket}
              <Animated.View pointerEvents="none" style={[styles.sheen, { width: sheenW }, sheen]}>
                <LinearGradient
                  colors={gradients.ticketSheen.colors as unknown as [string, string, ...string[]]}
                  locations={gradients.ticketSheen.locations as unknown as [number, number, ...number[]]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            {particles && !reduceMotion && <Particles t={t} width={ticketW} />}
          </Animated.View>
          <Animated.View style={actionsStyle}>{actions}</Animated.View>
        </View>
      </Pressable>
    </RevealCtx.Provider>
  );
}

function useFadeUp(t: SharedValue<number>, reduced: boolean, start: number) {
  return useAnimatedStyle(() => {
    if (reduced) return { opacity: seg(t.value, 0, REDUCED_TOTAL_MS, curve.soft) };
    const p = seg(t.value, start, start + 280, curve.out);
    return { opacity: p, transform: [{ translateY: 8 * (1 - p) }] };
  });
}

/* ── Particles: 12 motes, deterministic layout (no Math.random → same every time) ─────── */
const MOTES = Array.from({ length: 12 }, (_, i) => ({
  x: 0.08 + ((i * 0.37) % 0.84), // spread across the top edge
  rise: 24 + ((i * 7) % 17), // 24–40 pt
  drift: ((i % 3) - 1) * 8, // −8 / 0 / +8 pt
  size: i % 4 === 0 ? 3 : 2,
  tint: i % 2 ? color.gold300 : color.goldBright,
  start: 820 + i * 30,
}));

function Particles({ t, width }: { t: SharedValue<number>; width: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {MOTES.map((m, i) => (
        <Mote key={i} t={t} m={m} width={width} />
      ))}
    </View>
  );
}

function Mote({ t, m, width }: { t: SharedValue<number>; m: (typeof MOTES)[number]; width: number }) {
  const style = useAnimatedStyle(() => {
    const p = seg(t.value, m.start, m.start + 520, curve.out);
    return {
      opacity: p === 0 || p === 1 ? 0 : interpolate(p, [0, 0.25, 1], [0, 0.9, 0]),
      transform: [{ translateY: -m.rise * p }, { translateX: m.drift * p }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 6, left: m.x * width, width: m.size, height: m.size, borderRadius: m.size, backgroundColor: m.tint },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    width: 520,
    height: 520,
    borderRadius: 260,
    // Mockup .glow: radial amber. Static gradient via experimental_backgroundImage (RN ≥ 0.80);
    // fall back to a pre-rendered PNG (assets/glow-amber.png) if the PR's RN lacks it.
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 50%, rgba(242,166,90,0.35), rgba(224,138,60,0.08) 55%, transparent 75%)',
  },
  ticketWrap: { borderRadius: 26 },
  ticketClip: { borderRadius: 26, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -80, bottom: -80, left: 0 },
});
