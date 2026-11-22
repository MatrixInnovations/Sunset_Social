import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { toastImage } from '@/assets';

/** Photo stand-in for web and tests. Native builds use DoorViewfinder.native.tsx. */
export function DoorViewfinder(_props: { live: boolean; onCode: (code: string) => void }) {
  return (
    <View style={styles.fill}>
      <Image source={toastImage} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', borderRadius: 28 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,10,12,0.28)' },
});
