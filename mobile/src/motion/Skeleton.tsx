/**
 * Skeleton loading: ONE shared clock for every bone on screen (SkeletonProvider), so twenty
 * bones cost one animation, and every highlight moves in lock-step (reads as one light source).
 * Pass: highlight crosses each bone in 1300 ms (inOut), then rests 350 ms. Loops while mounted.
 * Base rgba(255,240,215,0.06); highlight peak rgba(255,240,215,0.08) on top → very low contrast.
 * Reduce motion: static bones, no highlight layer mounted at all.
 * Show skeletons only if data takes > 250 ms (avoid a flash on fast loads); cross-fade to
 * content over 240 ms when ready.
 */
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { DimensionValue, LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { dur, ease, gradients } from './motion';
import { useMotionPrefs } from './useMotionPrefs';

const Clock = createContext<SharedValue<number> | null>(null);

export function SkeletonProvider({ children }: { children: ReactNode }) {
  const { ambient } = useMotionPrefs();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!ambient) return;
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur.skeleton, easing: ease.inOut }),
        withTiming(1, { duration: dur.skeletonGap }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(p);
  }, [ambient, p]);
  return <Clock.Provider value={ambient ? p : null}>{children}</Clock.Provider>;
}

type BoneProps = { width?: DimensionValue; height: number; radius?: number; style?: ViewStyle };

export function Bone({ width = '100%', height, radius = 10, style }: BoneProps) {
  const p = useContext(Clock);
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const band = Math.max(80, w * 0.5);
  const hl = useAnimatedStyle(() => ({
    transform: [{ translateX: p ? interpolate(p.value, [0, 1], [-band, w]) : -band }],
  }));
  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: gradients.skeletonBase, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {p && w > 0 && (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: band }, hl]}>
          <LinearGradient
            colors={gradients.skeletonHighlight.colors as unknown as [string, string, ...string[]]}
            locations={gradients.skeletonHighlight.locations as unknown as [number, number, ...number[]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
