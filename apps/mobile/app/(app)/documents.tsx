import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface Document {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

interface ApiResponse<T> { data: T }

const CATEGORY_ICONS: Record<string, string> = {
  ata: '📋', regulamento: '📜', balancete: '💰', contrato: '📝',
  laudo: '🔍', circular: '📢', outro: '📄',
};

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await api.get<ApiResponse<Document[]>>('/documents');
      setDocs(res.data);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Documentos</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.emptyText}>Nenhum documento publicado.</Text>
            </View>
          }
          renderItem={({ item: d }) => (
            <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(d.file_url)}>
              <Text style={styles.docIcon}>{CATEGORY_ICONS[d.category] ?? '📄'}</Text>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle}>{d.title}</Text>
                <View style={styles.docMeta}>
                  <View style={styles.catBadge}>
                    <Text style={styles.catText}>{d.category}</Text>
                  </View>
                  <Text style={styles.docDate}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</Text>
                </View>
              </View>
              <Text style={styles.openIcon}>↗</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line,
  },
  docIcon: { fontSize: 28 },
  docInfo: { flex: 1, gap: 4 },
  docTitle: { fontSize: 14, color: colors.ink, ...font.semibold },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catBadge: {
    backgroundColor: colors.paper, borderRadius: radius.full,
    paddingVertical: 2, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line,
  },
  catText: { fontSize: 11, color: colors.muted },
  docDate: { fontSize: 11, color: colors.muted },
  openIcon: { fontSize: 18, color: colors.greenDark, ...font.bold },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
});
