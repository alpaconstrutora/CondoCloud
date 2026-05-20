import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface DashboardSummary {
  tickets_open: number;
  tickets_in_progress: number;
  charges_pending: number;
  charges_overdue: number;
  active_residents: number;
  total_messages: number;
}

interface ApiResponse<T> { data: T }

function StatCard({
  label, value, accent, sub,
}: {
  label: string; value: string | number; accent: string; sub?: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: accent }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Home() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (profile?.name ?? user?.user_metadata?.['full_name'] as string ?? 'Morador').split(' ')[0];
  const condoName = profile?.condominiums?.name ?? 'Meu Condomínio';

  async function load() {
    try {
      const res = await api.get<ApiResponse<DashboardSummary>>('/metrics/dashboard');
      setSummary(res.data);
    } catch { /* ignora erros de métricas */ }
    finally { setLoading(false); }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {firstName} 👋</Text>
          <Text style={styles.condoName}>{condoName}</Text>
        </View>
      </View>

      {/* Stats */}
      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginVertical: spacing.lg }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            label="Chamados abertos"
            value={summary?.tickets_open ?? 0}
            accent={colors.pink}
            sub={summary?.tickets_in_progress ? `${summary.tickets_in_progress} em andamento` : undefined}
          />
          <StatCard
            label="Cobranças pendentes"
            value={summary?.charges_pending ?? 0}
            accent={colors.amber}
            sub={summary?.charges_overdue ? `${summary.charges_overdue} em atraso` : undefined}
          />
          <StatCard
            label="Moradores"
            value={summary?.active_residents ?? 0}
            accent={colors.green}
          />
          <StatCard
            label="Comunicados"
            value={summary?.total_messages ?? 0}
            accent={colors.greenDark}
          />
        </View>
      )}

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Ações rápidas</Text>
      <View style={styles.actionsGrid}>
        <QuickAction icon="🎫" label="Abrir chamado" onPress={() => router.push('/(app)/tickets/index')} />
        <QuickAction icon="💬" label="Ver avisos" onPress={() => router.push('/(app)/messages')} />
        <QuickAction icon="📅" label="Reservas" onPress={() => router.push('/(app)/reservations')} />
        <QuickAction icon="📁" label="Documentos" onPress={() => router.push('/(app)/documents')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.lg },
  header: {
    backgroundColor: colors.greenDark, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.md,
  },
  greeting: { fontSize: 22, color: colors.white, ...font.extrabold },
  condoName: { fontSize: 13, color: '#9cc6b2', marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.white,
    borderRadius: radius.md, padding: spacing.md,
    borderLeftWidth: 4, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  statValue: { fontSize: 28, color: colors.ink, ...font.extrabold, lineHeight: 32 },
  statLabel: { fontSize: 12, color: colors.ink, ...font.semibold, marginTop: 4 },
  statSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 17, color: colors.ink, ...font.bold },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.white,
    borderRadius: radius.md, padding: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.line,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, color: colors.ink, ...font.semibold, textAlign: 'center' },
  amber: colors.amber,
});
