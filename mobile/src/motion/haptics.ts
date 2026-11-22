/**
 * Haptic vocabulary. Three cues only, so they keep their meaning.
 * Haptics are feedback, not motion: they still fire under reduce-motion.
 * Every call is fire-and-forget and swallowed on failure (simulators, web, low-power mode).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const safe = (p: Promise<unknown>) => {
  p.catch(() => {});
};

function cue(run: () => Promise<unknown>) {
  if (Platform.OS === 'web') return;
  safe(run());
}

export const haptic = {
  /** Reserve / primary gold buttons: on press-in, so it lands with the scale-down. */
  press: () => cue(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Tab change, segmented control (Upcoming / Past / Waitlist), quantity stepper. */
  select: () => cue(() => Haptics.selectionAsync()),
  /** Reservation confirmed: fired when the golden ticket lands (t = 700 ms in the reveal). */
  success: () => cue(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Payment failed / door scan rejected. */
  error: () => cue(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  platform: Platform.OS,
};
