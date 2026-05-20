import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, font } from '@/lib/theme';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : authError.message);
      setLoading(false);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}><Text style={styles.logoMarkText}>CC</Text></View>
          <Text style={styles.logoText}>CondoCloud</Text>
        </View>

        <Text style={styles.title}>Entrar na sua conta</Text>
        <Text style={styles.sub}>Bem-vindo de volta, morador.</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com.br"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnPrimaryText}>Entrar</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Não tem conta? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity><Text style={styles.footerLink}>Criar conta</Text></TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logoMark: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center',
  },
  logoMarkText: { color: colors.white, fontSize: 12, ...font.extrabold },
  logoText: { fontSize: 18, color: colors.greenDark, ...font.extrabold },
  title: { fontSize: 26, color: colors.ink, ...font.extrabold, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.muted, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.ink, ...font.semibold },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, backgroundColor: colors.white,
  },
  error: {
    fontSize: 13, color: '#c0334d', backgroundColor: '#fff0f3',
    borderWidth: 1, borderColor: '#ffc0cb', borderRadius: radius.sm,
    padding: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.greenDark, borderRadius: radius.full,
    padding: 15, alignItems: 'center', marginTop: spacing.xs,
  },
  btnPrimaryText: { color: colors.white, fontSize: 15, ...font.bold },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { fontSize: 14, color: colors.muted },
  footerLink: { fontSize: 14, color: colors.greenDark, ...font.semibold },
});
