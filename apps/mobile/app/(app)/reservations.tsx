import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface CommonArea { id: string; name: string }
interface Reservation {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'pending' | 'approved' | 'cancelled';
  notes?: string;
  common_areas?: { name: string };
}
interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', approved: 'Aprovada', cancelled: 'Cancelada' };
const STATUS_COLOR: Record<string, string> = { pending: colors.amber, approved: colors.green, cancelled: colors.muted };

function fmt(d: string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    try {
      const [resRes, areasRes] = await Promise.all([
        api.get<ApiResponse<Reservation[]>>('/reservations'),
        api.get<ApiResponse<CommonArea[]>>('/common-areas'),
      ]);
      setReservations(resRes.data);
      setAreas(areasRes.data);
      if (areasRes.data.length > 0) setSelectedArea(areasRes.data[0].id);
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

  async function handleCreate() {
    if (!selectedArea) { setCreateError('Selecione uma área.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const now = new Date();
      const starts = new Date(now.getTime() + 60 * 60 * 1000);
      const ends = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      await api.post('/reservations', {
        common_area_id: selectedArea,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      });
      setShowCreate(false);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao reservar');
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Reservas</Text>
        <TouchableOpacity style={styles.btnCreate} onPress={() => setShowCreate(true)}>
          <Text style={styles.btnCreateText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>Nenhuma reserva encontrada.</Text>
            </View>
          }
          renderItem={({ item: r }) => {
            const color = STATUS_COLOR[r.status] ?? colors.muted;
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardArea}>{r.common_areas?.name ?? '—'}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '25' }]}>
                    <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[r.status]}</Text>
                  </View>
                </View>
                <Text style={styles.cardTime}>{fmt(r.starts_at)} → {fmt(r.ends_at)}</Text>
                {r.notes && <Text style={styles.cardNotes}>{r.notes}</Text>}
              </View>
            );
          }}
        />
      )}

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova reserva</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.form}>
            <Text style={styles.label}>Área comum</Text>
            {areas.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma área comum disponível.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {areas.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.areaBtn, selectedArea === a.id && styles.areaBtnActive]}
                    onPress={() => setSelectedArea(a.id)}
                  >
                    <Text style={[styles.areaBtnText, selectedArea === a.id && styles.areaBtnTextActive]}>
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.hint}>
              A reserva será criada com início em 1h a partir de agora. Edite os horários com o síndico.
            </Text>
            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate} disabled={creating || areas.length === 0}>
              {creating
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnPrimaryText}>Solicitar reserva</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  pageTitle: { fontSize: 22, color: colors.ink, ...font.extrabold },
  btnCreate: { backgroundColor: colors.greenDark, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 16 },
  btnCreateText: { color: colors.white, fontSize: 13, ...font.bold },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 6,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardArea: { fontSize: 15, color: colors.ink, ...font.bold },
  cardTime: { fontSize: 13, color: colors.muted },
  cardNotes: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, ...font.semibold },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
  modal: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  modalTitle: { fontSize: 18, color: colors.ink, ...font.bold },
  modalClose: { fontSize: 18, color: colors.muted, padding: 4 },
  form: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 13, color: colors.ink, ...font.semibold },
  areaBtn: {
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper,
  },
  areaBtnActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  areaBtnText: { fontSize: 14, color: colors.ink, ...font.medium },
  areaBtnTextActive: { color: colors.white, ...font.semibold },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  errorText: {
    fontSize: 13, color: '#c0334d', backgroundColor: '#fff0f3',
    borderWidth: 1, borderColor: '#ffc0cb', borderRadius: radius.sm, padding: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.greenDark, borderRadius: radius.full,
    padding: 15, alignItems: 'center', marginTop: spacing.xs,
  },
  btnPrimaryText: { color: colors.white, fontSize: 15, ...font.bold },
});
