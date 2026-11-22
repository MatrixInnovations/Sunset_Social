import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useServices } from '@/bootstrap/ServicesContext';
import { colors, fonts } from '@/theme/tokens';

export function AuthScreen() {
  const services = useServices();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(
    services.mode === 'demo' ? 'Demo mode is on. The sample profile is already loaded.' : 'We’ll text or email a 6-digit code.',
  );

  async function run(action: () => Promise<void>) {
    try {
      await action();
      setMessage('Code sent. Enter the 6 digits to continue.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Try that again.');
    }
  }

  return (
    <View testID="screen-auth" style={styles.screen}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Close</Text>
      </Pressable>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.copy}>{message}</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="U.S. mobile" placeholderTextColor={colors.ivoryFaint} keyboardType="phone-pad" style={styles.input} />
      <Pressable style={styles.button} onPress={() => void run(() => services.auth.sendPhone(phone))}>
        <Text style={styles.buttonText}>Text a code</Text>
      </Pressable>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.ivoryFaint} autoCapitalize="none" style={styles.input} />
      <Pressable style={styles.button} onPress={() => void run(() => services.auth.sendEmail(email))}>
        <Text style={styles.buttonText}>Email a code</Text>
      </Pressable>
      <TextInput value={code} onChangeText={setCode} placeholder="6-digit code" placeholderTextColor={colors.ivoryFaint} keyboardType="number-pad" style={styles.input} />
      <Pressable
        style={styles.button}
        onPress={() =>
          void run(async () => {
            if (email.includes('@')) {
              await services.auth.verifyEmail(email, code);
            } else {
              await services.auth.verifyPhone(phone, code);
            }
          })
        }
      >
        <Text style={styles.buttonText}>Verify</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: 22 },
  back: { color: colors.gold, fontFamily: fonts.sansMedium, marginBottom: 18 },
  title: { color: colors.ivory, fontFamily: fonts.serif, fontSize: 40 },
  copy: { color: colors.ivoryDim, fontFamily: fonts.sans, marginVertical: 10, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.ivory,
    padding: 12,
    marginTop: 10,
    fontFamily: fonts.sans,
  },
  button: { marginTop: 8, alignSelf: 'flex-start' },
  buttonText: { color: colors.goldBright, fontFamily: fonts.sansSemi },
});
