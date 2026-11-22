import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useServices } from '@/bootstrap/ServicesContext';
import { BIO_LIMIT } from '@/domain/copy';
import { colors, fonts } from '@/theme/tokens';

export function EditProfileScreen() {
  const services = useServices();
  const router = useRouter();
  const client = useQueryClient();
  const viewer = services.guests.viewer();
  const profile = useQuery({ queryKey: ['profile', viewer.id], queryFn: () => services.guests.profile(viewer.id) });
  const [name, setName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayName = name ?? profile.data?.displayName ?? '';
  const bioValue = bio ?? profile.data?.bio ?? '';
  const save = useMutation({
    mutationFn: () => services.guests.update(viewer.id, { displayName, bio: bioValue }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['profile'] });
      await client.invalidateQueries({ queryKey: ['stats'] });
      router.back();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Could not save.'),
  });

  return (
    <View testID="screen-edit-profile" style={styles.screen}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Close</Text>
      </Pressable>
      <Text style={styles.title}>Guest profile</Text>
      <TextInput value={displayName} onChangeText={setName} style={styles.input} />
      <TextInput
        value={bioValue}
        onChangeText={setBio}
        multiline
        maxLength={BIO_LIMIT}
        placeholder="Bio"
        placeholderTextColor={colors.ivoryFaint}
        style={[styles.input, styles.bio]}
      />
      <Text style={styles.count}>{bioValue.length} / {BIO_LIMIT}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable testID="save-profile" style={styles.save} onPress={() => save.mutate()}>
        <Text style={styles.saveText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 22 },
  back: { color: colors.gold, fontFamily: fonts.sansMedium },
  title: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 36, marginVertical: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ivory,
    fontFamily: fonts.sans,
    padding: 12,
    marginTop: 8,
  },
  bio: { minHeight: 100, textAlignVertical: 'top' },
  count: { color: colors.ivoryFaint, fontFamily: fonts.sans, fontSize: 12, marginTop: 6 },
  error: { color: colors.danger, marginTop: 8, fontFamily: fonts.sans },
  save: { marginTop: 16, backgroundColor: colors.goldBright, borderRadius: 999, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.ink, fontFamily: fonts.sansSemi, letterSpacing: 1 },
});
