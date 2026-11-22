import type { ReactElement } from 'react';
import createQr from 'qrcode-generator';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { qrPayload } from '@/domain/format';

export function QrMark({ code, size = 148 }: { code: string; size?: number }) {
  const qr = createQr(0, 'M');
  qr.addData(qrPayload(code));
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  const marks: ReactElement[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        marks.push(<Rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell + 0.2} height={cell + 0.2} fill="#1a120c" />);
      }
    }
  }
  return (
    <View style={{ backgroundColor: '#fffdf8', padding: 10, borderRadius: 16 }}>
      <Svg width={size} height={size}>
        {marks}
      </Svg>
    </View>
  );
}
