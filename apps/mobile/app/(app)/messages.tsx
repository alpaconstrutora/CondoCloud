import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface Message {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  profiles?: { name: string };
}

interface ApiResponse<T> { data: T }

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await api.get<ApiResponse<Message[]>>('/messages');
      setMessages(res.data);
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

  async function markRead(id: string) {
    api.post(`/messages/${id}/read`, {}).catch(() => {});
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Comunicados</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>Nenhum comunicado publicado.</Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <TouchableOpacity style={styles.card} onPress={() => markRead(m.id)} activeOpacity={0.8}>
              {m.is_pinned && (
                <View style={styles.pinnedBadge}>
                  <Text style={styles.pinnedText}>📌 Fixado</Text>
                </View>
              )}
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text style={styles.cardBody} numberOfLines={3}>{m.body}</Text>
              <Text style={styles.cardMeta}>
                {m.profiles?.name ?? 'Síndico'} · {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
            </TouchableOpacity>
          )}
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
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 6,
  },
  pinnedBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.green + '20',
    borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8,
  },
  pinnedText: { fontSize: 11, color: colors.greenDark, ...font.semibold },
  cardTitle: { fontSize: 15, color: colors.ink, ...font.bold },
  cardBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: colors.muted },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
});
