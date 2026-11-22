import { StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/bootstrap/ServicesContext';
import { colors, fonts } from '@/theme/tokens';

export function LoungeScreen() {
  const services = useServices();
  return (
    <View testID="screen-lounge" style={styles.screen}>
      <Text style={styles.kicker}>LATER RELEASE</Text>
      <Text style={styles.title}>The lounge</Text>
      <Text style={styles.body}>{services.later.lounge()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 28 },
  kicker: { color: colors.gold, fontFamily: fonts.sansSemi, letterSpacing: 1.8, fontSize: 11 },
  title: { color: colors.ivory, fontFamily: fonts.serifItalic, fontSize: 42, marginTop: 8 },
  body: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
});
