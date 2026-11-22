/**
 * Live reduce-motion state.
 * Reanimated's `useReducedMotion()` is read once at app start and does not update when the
 * user flips the setting while the app is running. This hook starts from that synchronous
 * value (no first-frame flash of motion) and then follows AccessibilityInfo live.
 * Android: "Remove animations" (animator scale 0) reports as reduce-motion = true.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useMotionPrefs() {
  const initial = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState<boolean>(initial);

  useEffect(() => {
    let alive = true;
    const read = AccessibilityInfo.isReduceMotionEnabled?.();
    if (read) {
      read.then((value) => {
        if (alive) setReduceMotion(value);
      }).catch(() => undefined);
    }
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  return {
    reduceMotion,
    /** Ambient loops (shimmer, skeleton sweep, particles) run only when this is true. */
    ambient: !reduceMotion,
  };
}
