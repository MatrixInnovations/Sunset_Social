import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

export default function NotFound() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>That page is not on the evening.</Text>
      <Link href="/" style={styles.link}>
        Back to Discover
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 28, textAlign: 'center' },
  link: { color: colors.goldBright, marginTop: 12, fontFamily: fonts.sansSemi },
});
