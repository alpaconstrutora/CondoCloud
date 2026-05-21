import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Alert, Modal,
  TextInput, ScrollView, Pressable,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';
import { DOCUMENT_CATEGORIES } from '@condocloud/shared';
import type { Document, DocumentCategory, DocumentUploadUrl, DocumentsPage } from '@condocloud/shared';
import { useAuth } from '@/contexts/AuthContext';

interface ApiResponse<T> { data: T }

const CATEGORY_ICONS: Record<DocumentCategory, string> = {
  ata: '📋', regulamento: '📜', financeiro: '💰', contrato: '📝',
  planta: '🏗️', outro: '📄',
};

const PAGE_SIZE = 20;

// ── Upload via signed URL ─────────────────────────────────────
async function uploadToStorage(signedUrl: string, fileUri: string, mimeType: string): Promise<void> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const result = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!result.ok) throw new Error(`Erro no upload: ${result.status}`);
}

// ── Modal de envio de documento ───────────────────────────────
function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('outro');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPickedFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 0,
    });
  }

  async function handleUpload() {
    if (!title.trim()) { Alert.alert('Atenção', 'Preencha o título.'); return; }
    if (!pickedFile) { Alert.alert('Atenção', 'Selecione um arquivo.'); return; }

    setUploading(true);
    try {
      const { data: uploadData } = await api.post<ApiResponse<DocumentUploadUrl>>('/documents/upload-url', {
        filename: pickedFile.name,
        content_type: pickedFile.mimeType,
      });

      await uploadToStorage(uploadData.upload_url, pickedFile.uri, pickedFile.mimeType);

      await api.post('/documents', {
        title: title.trim(),
        category,
        file_url: uploadData.storage_path,
        storage_path: uploadData.storage_path,
        file_size_bytes: pickedFile.size,
      });

      onCreated();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao enviar documento');
      setUploading(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Enviar documento</Text>
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
            placeholder="Ata AGO — 2026"
            placeholderTextColor={colors.muted}
          />

          <Text style={modalStyles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {DOCUMENT_CATEGORIES.map(c => (
                <Pressable
                  key={c}
                  style={[modalStyles.chip, category === c && modalStyles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[modalStyles.chipTxt, category === c && modalStyles.chipActiveTxt]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={modalStyles.label}>Arquivo *</Text>
          <Pressable style={modalStyles.filePicker} onPress={pickFile}>
            <Text style={modalStyles.filePickerTxt}>
              {pickedFile ? `📎 ${pickedFile.name}` : '+ Selecionar arquivo'}
            </Text>
          </Pressable>

          <Pressable
            style={[modalStyles.submitBtn, uploading && modalStyles.submitBtnDisabled]}
            onPress={handleUpload}
            disabled={uploading}
          >
            <Text style={modalStyles.submitTxt}>{uploading ? 'Enviando…' : 'Enviar documento'}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Tela principal ────────────────────────────────────────────
export default function Documents() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<DocumentCategory | ''>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  const load = useCallback(async (p = 1, append = false) => {
    if (p === 1 && !append) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (filter) params.set('category', filter);
      const res = await api.get<ApiResponse<DocumentsPage>>(`/documents?${params}`);
      setDocs(prev => append ? [...prev, ...res.data.data] : res.data.data);
      setTotal(res.data.total);
      setPage(p);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => { load(1); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    load(1);
  }

  async function loadMore() {
    if (loadingMore || docs.length >= total) return;
    setLoadingMore(true);
    load(page + 1, true);
  }

  async function openDoc(doc: Document) {
    try {
      const { data } = await api.get<ApiResponse<{ url: string }>>(`/documents/${doc.id}/download`);
      await Linking.openURL(data.url);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível abrir o documento');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Documentos</Text>
        {isSindico && (
          <Pressable style={styles.uploadBtn} onPress={() => setShowUpload(true)}>
            <Text style={styles.uploadBtnTxt}>+ Enviar</Text>
          </Pressable>
        )}
      </View>

      {/* Filtro por categoria */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['', ...DOCUMENT_CATEGORIES] as Array<DocumentCategory | ''>).map(c => (
          <Pressable
            key={c || 'all'}
            style={[styles.filterChip, filter === c && styles.filterChipActive]}
            onPress={() => { setFilter(c); }}
          >
            <Text style={[styles.filterChipTxt, filter === c && styles.filterChipActiveTxt]}>
              {c || 'Todos'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={docs}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.green} style={{ padding: spacing.md }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.emptyText}>Nenhum documento publicado.</Text>
            </View>
          }
          renderItem={({ item: d }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDoc(d)} activeOpacity={0.7}>
              <Text style={styles.docIcon}>{CATEGORY_ICONS[d.category as DocumentCategory] ?? '📄'}</Text>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={2}>{d.title}</Text>
                <View style={styles.docMeta}>
                  <View style={styles.catBadge}>
                    <Text style={styles.catText}>{d.category}</Text>
                  </View>
                  {d.version > 1 && (
                    <View style={[styles.catBadge, { backgroundColor: '#e8f5e9' }]}>
                      <Text style={[styles.catText, { color: '#388e3c' }]}>v{d.version}</Text>
                    </View>
                  )}
                  <Text style={styles.docDate}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</Text>
                </View>
              </View>
              <Text style={styles.openIcon}>↗</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={() => { setShowUpload(false); load(1); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pageTitle: { fontSize: 22, color: colors.ink, ...font.extrabold },
  uploadBtn: {
    backgroundColor: colors.greenDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  uploadBtnTxt: { fontSize: 13, color: colors.white, ...font.semibold },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterChipTxt: { fontSize: 12, color: colors.muted, ...font.semibold },
  filterChipActiveTxt: { color: colors.white },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line,
  },
  docIcon: { fontSize: 28 },
  docInfo: { flex: 1, gap: 4 },
  docTitle: { fontSize: 14, color: colors.ink, ...font.semibold },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
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
  body: { padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 13, color: colors.ink, ...font.semibold, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.ink, marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  chipTxt: { fontSize: 13, color: colors.muted },
  chipActiveTxt: { color: colors.white },
  filePicker: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    borderStyle: 'dashed', padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md,
  },
  filePickerTxt: { fontSize: 14, color: colors.muted },
  submitBtn: {
    backgroundColor: colors.greenDark, borderRadius: radius.full,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitTxt: { fontSize: 15, color: colors.white, ...font.semibold },
});
