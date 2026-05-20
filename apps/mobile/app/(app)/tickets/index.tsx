import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface Ticket {
  id: string;
  title: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: number;
  created_at: string;
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado',
};
const STATUS_COLOR: Record<string, string> = {
  open: colors.pink, in_progress: colors.amber, resolved: colors.green, closed: colors.muted,
};
const PRIORITY_LABEL = ['', 'Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];
const CATEGORIES = ['hidraulica', 'eletrica', 'estrutural', 'limpeza', 'seguranca', 'outro'];
const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abertos' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvidos' },
];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '25' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function Tickets() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('outro');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    try {
      const res = await api.get<ApiResponse<Ticket[]>>(filter ? `/tickets?status=${filter}` : '/tickets');
      setTickets(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function handleCreate() {
    if (!title.trim()) { setCreateError('Título é obrigatório.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/tickets', { title, description, category, priority: 2 });
      setShowCreate(false);
      setTitle(''); setDescription(''); setCategory('outro');
      setFilter('open');
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar');
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Chamados</Text>
        <TouchableOpacity style={styles.btnCreate} onPress={() => setShowCreate(true)}>
          <Text style={styles.btnCreateText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[styles.filterBtn, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyText}>Nenhum chamado encontrado.</Text>
            </View>
          }
          renderItem={({ item: t }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/tickets/${t.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                <Badge label={STATUS_LABEL[t.status] ?? t.status} color={STATUS_COLOR[t.status] ?? colors.muted} />
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>{t.category}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.metaText, { color: t.priority >= 4 ? colors.pink : t.priority >= 3 ? colors.amber : colors.green }]}>
                  {PRIORITY_LABEL[t.priority]}
                </Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{new Date(t.created_at).toLocaleDateString('pt-BR')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo chamado</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Vazamento no corredor"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Descreva o problema..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Categoria</Text>
              <FlatList
                horizontal
                data={CATEGORIES}
                keyExtractor={c => c}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: c }) => (
                  <TouchableOpacity
                    style={[styles.filterBtn, category === c && styles.filterActive, { marginRight: 6 }]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

            <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate} disabled={creating}>
              {creating
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnPrimaryText}>Abrir chamado</Text>}
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
  filtersRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  filterBtn: {
    paddingVertical: 7, paddingHorizontal: 16, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white,
  },
  filterActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterText: { fontSize: 13, color: colors.muted, ...font.medium },
  filterTextActive: { color: colors.white, ...font.semibold },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 8,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, color: colors.ink, ...font.semibold, flex: 1 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  badgeText: { fontSize: 11, ...font.semibold },
  cardMeta: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  metaText: { fontSize: 12, color: colors.muted },
  metaDot: { fontSize: 12, color: colors.line },
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
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.ink, ...font.semibold },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, backgroundColor: colors.paper,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
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
