/**
 * ShimmerReserveButton — the gold "Reserve your place" pill with a slow golden-hour sweep.
 *
 *  • Fill: mockup gradient (180deg #F2D8A0 → #E3C16F → #C9A96E → #B8914F), static.
 *  • Shimmer: one warm-white band, 38 % of the button width, tilted 20°, crosses in 1400 ms
 *    (ease-in-out cubic) and then rests 5600 ms → a 7 s cycle. First pass 1200 ms after the
 *    screen is focused. Runs only on the UI thread (withRepeat), never touches React state.
 *  • Overdraw: between passes the band sits fully outside the pill's clipped bounds, so it
 *    draws zero pixels; during a pass it adds exactly one translucent layer over the pill.
 *  • Press: scale 0.97 in 110 ms + Light impact haptic on press-in; spring back on release.
 *  • Disabled (sold out / max reached): flat dark-gold glass, ivory-400 label, no glow,
 *    no shimmer, no haptic. Loading: spinner, shimmer paused, press ignored.
 *  • Reduce motion: no shimmer, no scale. Press feedback = 120 ms opacity dip to 0.85.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, dur, ease, gradients, pressSpring, scale } from './motion';
import { haptic } from './haptics';
import { useMotionPrefs } from './useMotionPrefs';

const FIRST_PASS_DELAY = 1200;
const REST_BETWEEN_PASSES = 5600; // sweep 1400 + rest 5600 = one pass every 7.0 s
const BAND_FRACTION = 0.38;
const BAND_TILT = '20deg';
const HEIGHT = 54;

type Props = {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Turn the ambient sweep off (e.g. on the small Discover "RESERVE" chip). */
  shimmer?: boolean;
  /** Discover chip is shorter than the sticky bar. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ShimmerReserveButton({
  label = 'Reserve your place',
  onPress,
  disabled = false,
  loading = false,
  shimmer = true,
  compact = false,
  style,
  testID,
}: Props) {
  const { reduceMotion, ambient } = useMotionPrefs();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0); // 0 = band parked left (outside), 1 = parked right (outside)
  const press = useSharedValue(0); // 0 rest, 1 pressed

  const canShimmer = shimmer && ambient && !disabled && !loading && width > 0;

  // Start/stop with screen focus so off-screen stack screens never animate.
  useFocusEffect(
    useCallback(() => {
      if (!canShimmer) return;
      // eslint-disable-next-line react-hooks/immutability
      sweep.value = 0;
      sweep.value = withDelay(
        FIRST_PASS_DELAY,
        withRepeat(
          withSequence(
            withTiming(1, { duration: dur.sweep, easing: ease.inOut, reduceMotion: ReduceMotion.Never }),
            withTiming(1, { duration: REST_BETWEEN_PASSES }), // hold outside the pill (draws nothing)
            withTiming(0, { duration: 0 }), // jump back to the left, still outside
          ),
          -1,
        ),
      );
      return () => {
        cancelAnimation(sweep);
        sweep.value = 0;
      };
    }, [canShimmer, sweep]),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const bandW = width * BAND_FRACTION;
  const bandStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-bandW * 1.6, width + bandW * 0.6]) },
      { rotate: BAND_TILT },
    ],
  }));

  const pillStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - press.value * 0.15 }
      : { transform: [{ scale: 1 - press.value * (1 - scale.pressed) }] },
  );

  const inactive = disabled || loading;

  const onPressIn = () => {
    if (inactive) return;
    press.value = withTiming(1, { duration: reduceMotion ? 120 : dur.pressIn, easing: ease.press });
    haptic.press();
  };
  const onPressOut = () => {
    press.value = reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0, pressSpring);
  };

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={6}
      style={style}
      testID={testID}
    >
      <Animated.View style={[styles.shadowWrap, !inactive && styles.glow, pillStyle]} onLayout={onLayout}>
        <View style={[styles.pill, compact && styles.pillCompact, disabled && styles.pillDisabled]}>
          <LinearGradient
            colors={(disabled ? gradients.reserveDisabled.colors : gradients.reserveFill.colors) as unknown as [string, string, ...string[]]}
            locations={(disabled ? gradients.reserveDisabled.locations : gradients.reserveFill.locations) as unknown as [number, number, ...number[]]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {canShimmer && (
            <Animated.View pointerEvents="none" style={[styles.band, { width: bandW }, bandStyle]}>
              <LinearGradient
                colors={gradients.reserveShimmer.colors as unknown as [string, string, ...string[]]}
                locations={gradients.reserveShimmer.locations as unknown as [number, number, ...number[]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
          {loading ? (
            <ActivityIndicator color={color.btnText} />
          ) : (
            <Text style={[styles.label, compact && styles.labelCompact, disabled && styles.labelDisabled]} numberOfLines={1}>
              {label.toUpperCase()}
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { borderRadius: 999 },
  // Static glow. Never animate shadows: they re-rasterise every frame on both platforms.
  glow: { boxShadow: '0px 12px 30px rgba(227,193,111,0.28)' },
  pill: {
    height: HEIGHT,
    borderRadius: 999,
    overflow: 'hidden', // clips the band → no overdraw outside the pill
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.6), inset 0px -2px 0px rgba(0,0,0,0.15)',
  },
  pillCompact: { height: 40, paddingHorizontal: 16 },
  pillDisabled: {
    borderWidth: 1,
    borderColor: 'rgba(230,211,163,0.22)',
    boxShadow: undefined,
  },
  band: {
    position: 'absolute',
    top: -HEIGHT, // tall band so the 20° tilt still covers the full pill height
    bottom: -HEIGHT,
    left: 0,
  },
  label: {
    color: color.btnText,
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.16,
  },
  labelCompact: { fontSize: 12, letterSpacing: 1.2 },
  labelDisabled: { color: color.ivory400 },
});
