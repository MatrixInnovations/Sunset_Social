/**
 * Tab bar item: icon + label cross-fade ivory-400 → gold-bright, and the 4 pt gold dot
 * (mockup .tab.on::after) grows 0 → 1 under the active tab. 180 ms, out curve.
 * Selection haptic is fired from the Tabs `tabPress` listener (see spec §5.2), not here.
 * Reduce motion: colour cross-fade + dot fade only (no scale).
 */
import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, dur, ease } from './motion';
import { useMotionPrefs } from './useMotionPrefs';

type Props = { focused: boolean; label: string; renderIcon: (tint: string) => ReactNode };

export function AnimatedTabIcon({ focused, label, renderIcon }: Props) {
  const { reduceMotion } = useMotionPrefs();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: dur.micro, easing: ease.out });
  }, [focused, on]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [color.ivory400, color.goldBright]),
  }));
  const iconOn = useAnimatedStyle(() => ({ opacity: on.value }));
  const iconOff = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const dotStyle = useAnimatedStyle(() =>
    reduceMotion ? { opacity: on.value } : { opacity: on.value, transform: [{ scale: on.value }] },
  );

  return (
    <View style={styles.item}>
      {/* Icons are SVG strokes: render both tints and cross-fade, never re-render the SVG per frame. */}
      <View>
        <Animated.View style={iconOff}>{renderIcon(color.ivory400)}</Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, iconOn]}>{renderIcon(color.goldBright)}</Animated.View>
      </View>
      <Animated.Text style={[styles.label, labelStyle]}>{label.toUpperCase()}</Animated.Text>
      <Animated.View style={[styles.dot, dotStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: 4 },
  label: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, letterSpacing: 1 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.goldBright,
    boxShadow: '0px 0px 8px #E3C16F',
  },
});
