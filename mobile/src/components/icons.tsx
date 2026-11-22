import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type IconProps = { color?: string; size?: number };

export function DiscoverIcon({ color = colors.ivory, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.2} stroke={color} strokeWidth={1.4} />
      <Path d="M14.8 9.2 13.2 13.2 9.2 14.8 10.8 10.8 14.8 9.2Z" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

export function TicketIcon({ color = colors.ivory, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.2a2 2 0 0 0 0 4.6v1.2A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-1.2a2 2 0 0 0 0-4.6V8.5Z"
        stroke={color}
        strokeWidth={1.4}
      />
      <Path d="M12 7.5v9" stroke={color} strokeWidth={1.4} strokeDasharray="1.5 2" />
    </Svg>
  );
}

export function GuestsIcon({ color = colors.ivory, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={9} r={2.4} stroke={color} strokeWidth={1.4} />
      <Circle cx={15.5} cy={10} r={2} stroke={color} strokeWidth={1.4} />
      <Path d="M4.8 17.2c.6-2.2 2.3-3.4 4.2-3.4s3.6 1.2 4.2 3.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M14 14.2c1.4-.2 2.8.4 3.6 1.8" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function LoungeIcon({ color = colors.ivory, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 16.5V8.8A2.8 2.8 0 0 1 8.8 6h6.4A2.8 2.8 0 0 1 18 8.8v4.2a2.8 2.8 0 0 1-2.8 2.8H9l-3 2.2v-1.5Z"
        stroke={color}
        strokeWidth={1.4}
      />
    </Svg>
  );
}

export function ProfileIcon({ color = colors.ivory, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={9} r={2.7} stroke={color} strokeWidth={1.4} />
      <Path d="M6.5 17.6c.8-2.4 2.7-3.6 5.5-3.6s4.7 1.2 5.5 3.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ color = colors.gold300, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 16.5h12l-1.2-2V10a4.8 4.8 0 0 0-9.6 0v4.5L6 16.5Z" stroke={color} strokeWidth={1.4} />
      <Path d="M10 18a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

export function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5.5} width={16} height={14} rx={2} stroke={colors.gold} strokeWidth={1.4} />
      <Path d="M8 4.5v3M16 4.5v3M4 10h16" stroke={colors.gold} strokeWidth={1.4} />
    </Svg>
  );
}

export function PinIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20s6-5.1 6-9.2A6 6 0 0 0 6 10.8C6 14.9 12 20 12 20Z" stroke={colors.gold} strokeWidth={1.4} />
      <Circle cx={12} cy={10.5} r={1.6} stroke={colors.gold} strokeWidth={1.4} />
    </Svg>
  );
}

export function WaveIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M8 13c.4-3 1.6-5 3.2-5 1.2 0 1.6 1 1.8 2.2" stroke={colors.goldBright} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M7 16c2.2.8 4.2.4 6.4-.8 1.4-.8 2.6-.6 3.6.4" stroke={colors.goldBright} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function AppleMark() {
  return (
    <Svg width={16} height={18} viewBox="0 0 16 18" fill="none">
      <Path
        d="M12.7 9.4c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7 1.8-1 2.5-2c.8-1.1 1.1-2.2 1.1-2.2s-2.1-.8-2.1-3.7Z"
        fill={colors.white}
      />
      <Path d="M10.8 3.6c.6-.7 1-1.7.9-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.6-.9 2.5.9.1 1.8-.4 2.4-1.2Z" fill={colors.white} />
    </Svg>
  );
}
