import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, font } from '@/lib/theme';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', { name, email, password });
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      if (inviteToken.trim()) {
        await api.post('/invite/resolve', { token: inviteToken.trim() });
      }

      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoMark}><Text style={styles.logoMarkText}>CC</Text></View>
          <Text style={styles.logoText}>CondoCloud</Text>
        </View>

        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.sub}>Acesse o app do seu condomínio.</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="João da Silva"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />
          </View>

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
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Código de convite <Text style={styles.optional}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={inviteToken}
              onChangeText={setInviteToken}
              placeholder="Cole o token recebido por WhatsApp"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.btnPrimaryText}>Criar conta</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity><Text style={styles.footerLink}>Entrar</Text></TouchableOpacity>
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
  optional: { fontSize: 11, color: colors.muted, ...font.regular },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, backgroundColor: colors.white,
  },
  error: {
    fontSize: 13, color: '#c0334d', backgroundColor: '#fff0f3',
    borderWidth: 1, borderColor: '#ffc0cb', borderRadius: radius.sm, padding: spacing.sm,
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
