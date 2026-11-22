import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, fonts } from '@/theme/tokens';

export function NotesScreen() {
  const router = useRouter();
  return (
    <View testID="screen-notes" style={styles.screen}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Close</Text>
      </Pressable>
      <Text style={styles.title}>Notes</Text>
      <Text style={styles.body}>No notes yet. Turn on “Text me when dates drop” and we’ll write when a date is set.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 22 },
  back: { color: colors.gold, fontFamily: fonts.sansMedium },
  title: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 40, marginTop: 16 },
  body: { color: colors.ivoryDim, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, marginTop: 8 },
});
