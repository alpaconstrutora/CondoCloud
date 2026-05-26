import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface AssemblyItem {
  id: string;
  title: string;
  description?: string;
  result?: string;
  votes?: { vote: string }[];
}

interface Assembly {
  id: string;
  title: string;
  date: string;
  location?: string;
  status: 'scheduled' | 'open' | 'closed' | 'cancelled';
  minutes_url?: string;
  assembly_items?: AssemblyItem[];
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  open: 'Em andamento',
  closed: 'Encerrada',
  cancelled: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  scheduled: colors.amber,
  open: colors.green,
  closed: colors.muted,
  cancelled: colors.pink,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function AssemblyCard({ item }: { item: Assembly }) {
  const color = STATUS_COLOR[item.status] ?? colors.muted;
  const label = STATUS_LABEL[item.status] ?? item.status;
  const pautas = item.assembly_items?.length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={[styles.badge, { backgroundColor: color + '25' }]}>
          <Text style={[styles.badgeText, { color }]}>{label}</Text>
        </View>
      </View>

      <Text style={styles.cardDate}>{fmtDate(item.date)}</Text>

      {item.location ? (
        <Text style={styles.cardLocation}>📍 {item.location}</Text>
      ) : null}

      {pautas > 0 && (
        <Text style={styles.cardPautas}>{pautas} pauta{pautas !== 1 ? 's' : ''}</Text>
      )}

      {item.assembly_items && item.assembly_items.length > 0 && (
        <View style={styles.pautasList}>
          {item.assembly_items.slice(0, 3).map((p, idx) => (
            <View key={p.id} style={styles.pautaItem}>
              <Text style={styles.pautaNum}>{idx + 1}.</Text>
              <Text style={styles.pautaTitle} numberOfLines={1}>{p.title}</Text>
              {p.result && (
                <Text style={[
                  styles.pautaResult,
                  { color: p.result === 'approved' ? colors.green : p.result === 'rejected' ? colors.pink : colors.amber },
                ]}>
                  {p.result === 'approved' ? '✓' : p.result === 'rejected' ? '✗' : '—'}
                </Text>
              )}
            </View>
          ))}
          {item.assembly_items.length > 3 && (
            <Text style={styles.morePautas}>+{item.assembly_items.length - 3} mais…</Text>
          )}
        </View>
      )}

      {item.minutes_url && (
        <TouchableOpacity
          style={styles.minutesBtn}
          onPress={() => Linking.openURL(item.minutes_url!)}
        >
          <Text style={styles.minutesBtnText}>📄 Ver ata</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'' | 'scheduled' | 'open' | 'closed'>('');

  async function load() {
    try {
      const url = filter ? `/assemblies?status=${filter}` : '/assemblies';
      const res = await api.get<ApiResponse<Assembly[]>>(url);
      setAssemblies(res.data ?? []);
    } catch { /* ignora */ }
    finally { setLoading(false); }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [filter]);

  const FILTERS: { value: '' | 'scheduled' | 'open' | 'closed'; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'scheduled', label: 'Agendadas' },
    { value: 'open', label: 'Em andamento' },
    { value: 'closed', label: 'Encerradas' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Assembleias</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
            onPress={() => { setLoading(true); setFilter(f.value); }}
          >
            <Text style={[styles.filterBtnText, filter === f.value && styles.filterBtnTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={assemblies}
          keyExtractor={a => a.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗳️</Text>
              <Text style={styles.emptyText}>Nenhuma assembleia encontrada.</Text>
            </View>
          }
          renderItem={({ item }) => <AssemblyCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pageTitle: { fontSize: 22, color: colors.ink, ...font.extrabold },
  filterRow: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  filterBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full,
    backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
  },
  filterBtnActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterBtnText: { fontSize: 12, color: colors.muted, ...font.semibold },
  filterBtnTextActive: { color: colors.white },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 6,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, color: colors.ink, ...font.bold },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, ...font.semibold },
  cardDate: { fontSize: 12, color: colors.muted },
  cardLocation: { fontSize: 12, color: colors.muted },
  cardPautas: { fontSize: 12, color: colors.muted, ...font.medium },
  pautasList: {
    borderTopWidth: 1, borderTopColor: colors.line,
    paddingTop: spacing.sm, marginTop: spacing.xs, gap: 4,
  },
  pautaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pautaNum: { fontSize: 12, color: colors.muted, width: 18 },
  pautaTitle: { flex: 1, fontSize: 12, color: colors.ink },
  pautaResult: { fontSize: 13, ...font.bold },
  morePautas: { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 2 },
  minutesBtn: {
    marginTop: 6, backgroundColor: colors.paper, borderRadius: radius.sm,
    padding: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line,
  },
  minutesBtnText: { fontSize: 13, color: colors.greenDark, ...font.semibold },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
});
