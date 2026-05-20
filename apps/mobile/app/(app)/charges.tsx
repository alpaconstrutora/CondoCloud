import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius, font } from '@/lib/theme';

interface Charge {
  id: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  description: string;
  paid_at?: string;
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Em atraso' };
const STATUS_COLOR: Record<string, string> = { pending: colors.amber, paid: colors.green, overdue: colors.pink };

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Charges() {
  const { profile } = useAuth();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unitId = (profile as unknown as { unit_id?: string })?.unit_id;

  async function load() {
    try {
      const path = unitId ? `/charges/unit/${unitId}` : '/charges';
      const res = await api.get<ApiResponse<Charge[]>>(path);
      setCharges(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const totalPending = charges.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Cobranças</Text>
      </View>

      {totalPending > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            💰 Total em aberto: <Text style={styles.alertValue}>{fmt(totalPending)}</Text>
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={charges}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyText}>Nenhuma cobrança encontrada.</Text>
            </View>
          }
          renderItem={({ item: c }) => {
            const color = STATUS_COLOR[c.status] ?? colors.muted;
            return (
              <View style={[styles.card, c.status === 'overdue' && styles.cardOverdue]}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardDesc}>{c.description || 'Taxa condominial'}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '25' }]}>
                    <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[c.status]}</Text>
                  </View>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardAmount}>{fmt(c.amount)}</Text>
                  <Text style={styles.cardDate}>
                    Venc. {new Date(c.due_date).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                {c.paid_at && (
                  <Text style={styles.paidAt}>
                    Pago em {new Date(c.paid_at).toLocaleDateString('pt-BR')}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  pageTitle: { fontSize: 22, color: colors.ink, ...font.extrabold },
  alertBanner: {
    backgroundColor: '#fff8e1', borderBottomWidth: 1, borderBottomColor: '#ffe082',
    padding: spacing.md, paddingHorizontal: spacing.lg,
  },
  alertText: { fontSize: 14, color: '#7a5800' },
  alertValue: { ...font.bold },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 8,
  },
  cardOverdue: { borderColor: colors.pink + '60', borderLeftWidth: 3, borderLeftColor: colors.pink },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDesc: { fontSize: 14, color: colors.ink, ...font.semibold, flex: 1 },
  cardAmount: { fontSize: 18, color: colors.ink, ...font.extrabold },
  cardDate: { fontSize: 12, color: colors.muted },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, ...font.semibold },
  paidAt: { fontSize: 11, color: colors.green },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
});
