import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/theme/tokens';

export function Ink({ children, testID, style }: { children: ReactNode; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View testID={testID} style={[styles.ink, style]}>
      {children}
    </View>
  );
}

export function Seal({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={12.4} stroke={colors.gold} strokeWidth={1} fill="none" />
      <SvgText
        x={14}
        y={17.5}
        textAnchor="middle"
        fontSize={10}
        fontFamily={fonts.serifItalic}
        fill={colors.gold}
      >
        SS
      </SvgText>
    </Svg>
  );
}

export function Wordmark() {
  return <Text style={styles.wordmark}>SUNSET SOCIAL</Text>;
}

export function Pill({ label, tone = 'ghost' }: { label: string; tone?: 'ghost' | 'gold' }) {
  return (
    <View style={[styles.pill, tone === 'gold' ? styles.pillGold : styles.pillGhost]}>
      <Text style={[styles.pillText, tone === 'gold' ? styles.pillTextInk : styles.pillTextIvory]}>{label}</Text>
    </View>
  );
}

export function GoldButton({
  label,
  onPress,
  testID,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  compact?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.goldButton, compact && styles.goldCompact, pressed && styles.pressed]}
    >
      <Text style={[styles.goldLabel, compact && styles.goldLabelCompact]}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.outline, pressed && styles.pressed]}>
      <Text style={styles.outlineLabel}>{label}</Text>
    </Pressable>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function FieldCard({ children }: { children: ReactNode }) {
  return <View style={styles.field}>{children}</View>;
}

export function Toggle({ value, onChange, testID }: { value: boolean; onChange: (next: boolean) => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ink: { flex: 1, backgroundColor: colors.ink },
  wordmark: {
    color: colors.ivory,
    fontFamily: fonts.sansMedium,
    letterSpacing: 3.2,
    fontSize: 12,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  pillGhost: {
    backgroundColor: 'rgba(11,10,12,0.45)',
    borderColor: 'rgba(244,236,221,0.28)',
  },
  pillGold: {
    backgroundColor: colors.goldBright,
    borderColor: colors.goldBright,
  },
  pillText: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  pillTextIvory: { color: colors.ivory },
  pillTextInk: { color: colors.ink },
  goldButton: {
    backgroundColor: colors.goldBright,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  goldCompact: { minHeight: 40, paddingHorizontal: 16 },
  goldLabel: {
    color: colors.ink,
    fontFamily: fonts.sansSemi,
    letterSpacing: 1.4,
    fontSize: 13,
  },
  goldLabelCompact: { fontSize: 12, letterSpacing: 1.1 },
  outline: {
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  outlineLabel: {
    color: colors.gold300,
    fontFamily: fonts.sansSemi,
    letterSpacing: 1.2,
    fontSize: 12,
  },
  pressed: { opacity: 0.86 },
  eyebrow: {
    color: colors.gold,
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  field: {
    backgroundColor: colors.inkCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.gold },
  trackOff: { backgroundColor: '#2a2722' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ivory,
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});
