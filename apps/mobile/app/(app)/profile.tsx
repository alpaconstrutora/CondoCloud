import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPushEnabled(status === 'granted');
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await api.patch('/auth/profile', { name, phone: phone || undefined });
      await refreshProfile();
      setSaveMsg('Perfil atualizado!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function togglePush() {
    setPushLoading(true);
    try {
      if (!pushEnabled) {
        const token = await registerPushToken();
        if (token) {
          await api.patch('/auth/profile', { push_token: token });
          setPushEnabled(true);
        } else {
          Alert.alert('Permissão negada', 'Habilite as notificações nas configurações do dispositivo.');
        }
      } else {
        await api.patch('/auth/profile', { push_token: null });
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  const initials = (profile?.name ?? user?.email ?? 'U')[0].toUpperCase();

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{profile?.name ?? 'Morador'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {profile?.role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{profile.role}</Text>
          </View>
        )}
      </View>

      {/* Edit form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados pessoais</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome completo"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="(11) 99999-9999"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
        </View>

        {saveMsg ? <Text style={styles.saveMsg}>{saveMsg}</Text> : null}

        <TouchableOpacity style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnPrimaryText}>Salvar</Text>}
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowSub}>Receba alertas de chamados, cobranças e comunicados</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, pushEnabled && styles.toggleOn]}
            onPress={togglePush}
            disabled={pushLoading}
          >
            {pushLoading
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.toggleText}>{pushEnabled ? 'ON' : 'OFF'}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Condomínio info */}
      {profile?.condominiums?.name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meu condomínio</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{profile.condominiums.name}</Text>
          </View>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.btnSignOut} onPress={handleSignOut}>
        <Text style={styles.btnSignOutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.lg, paddingTop: spacing.xl + spacing.lg },
  avatarSection: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenDark,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.white, fontSize: 28, ...font.extrabold },
  userName: { fontSize: 20, color: colors.ink, ...font.bold },
  userEmail: { fontSize: 13, color: colors.muted },
  roleBadge: {
    backgroundColor: colors.green + '20', borderRadius: radius.full,
    paddingVertical: 3, paddingHorizontal: 12,
  },
  roleText: { fontSize: 12, color: colors.greenDark, ...font.semibold },
  section: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.line,
  },
  sectionTitle: { fontSize: 16, color: colors.ink, ...font.bold },
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.ink, ...font.semibold },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, backgroundColor: colors.paper,
  },
  saveMsg: { fontSize: 13, color: colors.green, ...font.semibold },
  btnPrimary: {
    backgroundColor: colors.greenDark, borderRadius: radius.full,
    padding: 14, alignItems: 'center',
  },
  btnPrimaryText: { color: colors.white, fontSize: 15, ...font.bold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, color: colors.ink, ...font.semibold },
  rowSub: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  toggle: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.full,
    backgroundColor: colors.line, minWidth: 60, alignItems: 'center',
  },
  toggleOn: { backgroundColor: colors.green },
  toggleText: { fontSize: 12, color: colors.white, ...font.bold },
  infoCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, color: colors.ink, ...font.semibold },
  btnSignOut: {
    borderWidth: 1, borderColor: '#ffc0cb', backgroundColor: '#fff0f3',
    borderRadius: radius.full, padding: 14, alignItems: 'center',
  },
  btnSignOutText: { fontSize: 15, color: '#c0334d', ...font.semibold },
});
