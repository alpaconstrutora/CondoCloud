import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  ScrollView, Pressable, Alert,
} from 'react-native';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import type { MessageWithMeta, MessagesPage } from '@condocloud/shared';

interface ApiResponse<T> { data: T }

const PAGE_SIZE = 20;

// ── Modal de criação ──────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) { Alert.alert('Atenção', 'Preencha título e mensagem.'); return; }
    setLoading(true);
    try {
      await api.post('/messages', { title: title.trim(), content: content.trim(), pinned, audience: 'all' });
      onCreated();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao publicar');
      setLoading(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Novo comunicado</Text>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeTxt}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={modalStyles.body}>
          <Text style={modalStyles.label}>Título *</Text>
          <TextInput
            style={modalStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Manutenção do elevador..."
            placeholderTextColor={colors.muted}
          />
          <Text style={modalStyles.label}>Mensagem *</Text>
          <TextInput
            style={[modalStyles.input, { minHeight: 120, textAlignVertical: 'top' }]}
            value={content}
            onChangeText={setContent}
            placeholder="Informamos que..."
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable style={modalStyles.checkRow} onPress={() => setPinned(p => !p)}>
            <View style={[modalStyles.checkbox, pinned && modalStyles.checkboxActive]}>
              {pinned && <Text style={{ color: colors.white, fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={modalStyles.checkLabel}>Fixar no topo</Text>
          </Pressable>
          <Pressable
            style={[modalStyles.submitBtn, loading && modalStyles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={modalStyles.submitTxt}>{loading ? 'Publicando…' : 'Publicar comunicado'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Tela principal ────────────────────────────────────────────
export default function Messages() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  const load = useCallback(async (p = 1, append = false) => {
    if (p === 1 && !append) setLoading(true);
    try {
      const res = await api.get<ApiResponse<MessagesPage>>(`/messages?page=${p}&page_size=${PAGE_SIZE}`);
      setMessages(prev => append ? [...prev, ...res.data.data] : res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  async function onRefresh() { setRefreshing(true); load(1); }

  async function loadMore() {
    if (loadingMore || messages.length >= total) return;
    setLoadingMore(true);
    load(page + 1, true);
  }

  async function markRead(id: string) {
    api.post(`/messages/${id}/read`, {}).catch(() => {});
    setMessages(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Comunicados</Text>
        {isSindico && (
          <Pressable style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.addBtnTxt}>+ Publicar</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.green} style={{ padding: spacing.md }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>Nenhum comunicado publicado.</Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <TouchableOpacity
              style={[styles.card, m.unread && styles.cardUnread]}
              onPress={() => markRead(m.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badges}>
                  {m.pinned && (
                    <View style={styles.pinnedBadge}>
                      <Text style={styles.pinnedText}>📌 Fixado</Text>
                    </View>
                  )}
                  {m.unread && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>Novo</Text>
                    </View>
                  )}
                </View>
                {isSindico && m.read_count > 0 && (
                  <Text style={styles.readCount}>👁 {m.read_count}</Text>
                )}
              </View>
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text style={styles.cardBody} numberOfLines={3}>{m.content}</Text>
              <Text style={styles.cardMeta}>
                {m.profiles?.name ?? 'Síndico'} · {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(1); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  pageTitle: { fontSize: 22, color: colors.ink, ...font.extrabold },
  addBtn: { backgroundColor: colors.greenDark, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  addBtnTxt: { fontSize: 13, color: colors.white, ...font.semibold },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 6,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.green },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  pinnedBadge: { alignSelf: 'flex-start', backgroundColor: colors.green + '20', borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8 },
  pinnedText: { fontSize: 11, color: colors.greenDark, ...font.semibold },
  unreadBadge: { alignSelf: 'flex-start', backgroundColor: '#1a73e820', borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8 },
  unreadText: { fontSize: 11, color: '#1a73e8', ...font.semibold },
  readCount: { fontSize: 12, color: colors.muted },
  cardTitle: { fontSize: 15, color: colors.ink, ...font.bold },
  cardBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: colors.muted },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  title: { fontSize: 18, color: colors.ink, ...font.extrabold },
  closeBtn: { padding: spacing.xs },
  closeTxt: { fontSize: 16, color: colors.muted },
  body: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: 13, color: colors.ink, ...font.semibold, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, marginBottom: spacing.md,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  checkLabel: { fontSize: 13, color: colors.ink, ...font.semibold },
  submitBtn: { backgroundColor: colors.greenDark, borderRadius: radius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  submitBtnDisabled: { opacity: 0.6 },
  submitTxt: { fontSize: 15, color: colors.white, ...font.semibold },
});
