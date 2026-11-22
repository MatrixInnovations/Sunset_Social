import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toastImage } from '@/assets';
import { colors, fonts } from '@/theme/tokens';

export function DoorViewfinder({ live, onCode }: { live: boolean; onCode: (code: string) => void }) {
  const [permission, request] = useCameraPermissions();
  if (live && permission?.granted) {
    return (
      <CameraView
        style={styles.fill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onCode(data)}
      />
    );
  }
  return (
    <View style={styles.fill}>
      <Image source={toastImage} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />
      <View style={styles.scrim} />
      {!permission?.granted ? (
        <Pressable style={styles.enable} onPress={() => void request()}>
          <Text style={styles.enableText}>Enable the camera</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', borderRadius: 28 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,10,12,0.28)' },
  enable: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  enableText: { color: colors.gold300, fontFamily: fonts.sansMedium, fontSize: 12 },
});
