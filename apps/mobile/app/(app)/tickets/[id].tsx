import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { colors, spacing, radius, font } from '@/lib/theme';

interface TicketUpdate {
  id: string;
  content: string;
  created_at: string;
  profiles?: { name: string };
}

interface Ticket {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: number;
  created_at: string;
  ticket_updates?: TicketUpdate[];
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', closed: 'Fechado',
};
const STATUS_COLOR: Record<string, string> = {
  open: colors.pink, in_progress: colors.amber, resolved: colors.green, closed: colors.muted,
};
const PRIORITY_LABEL = ['', 'Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];

export default function TicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateContent, setUpdateContent] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const res = await api.get<ApiResponse<Ticket>>(`/tickets/${id}`);
      setTicket(res.data);
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function sendUpdate() {
    if (!updateContent.trim() || !id) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/updates`, { content: updateContent });
      setUpdateContent('');
      load();
    } finally {
      setSending(false);
    }
  }

  if (loading || !ticket) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  const statusColor = STATUS_COLOR[ticket.status] ?? colors.muted;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Chamados</Text>
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: statusColor + '25' }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_LABEL[ticket.status]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{ticket.title}</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>{ticket.category}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>{PRIORITY_LABEL[ticket.priority]}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</Text>
        </View>

        {ticket.description && (
          <View style={styles.descCard}>
            <Text style={styles.descText}>{ticket.description}</Text>
          </View>
        )}

        {/* Updates */}
        <Text style={styles.sectionTitle}>Atualizações</Text>
        {(!ticket.ticket_updates || ticket.ticket_updates.length === 0) ? (
          <Text style={styles.emptyUpdates}>Nenhuma atualização ainda.</Text>
        ) : (
          <View style={styles.updatesList}>
            {ticket.ticket_updates.map(u => (
              <View key={u.id} style={styles.updateCard}>
                <Text style={styles.updateMeta}>
                  {u.profiles?.name ?? 'Usuário'} · {new Date(u.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </Text>
                <Text style={styles.updateBody}>{u.content}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add update */}
      <View style={styles.replyBar}>
        <TextInput
          style={styles.replyInput}
          value={updateContent}
          onChangeText={setUpdateContent}
          placeholder="Adicionar atualização…"
          placeholderTextColor={colors.muted}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !updateContent.trim() && styles.sendBtnDisabled]}
          onPress={sendUpdate}
          disabled={sending || !updateContent.trim()}
        >
          {sending
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={styles.sendBtnText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  back: {}, backText: { fontSize: 14, color: colors.greenDark, ...font.semibold },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  badgeText: { fontSize: 12, ...font.semibold },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 20, color: colors.ink, ...font.bold, lineHeight: 28 },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  metaItem: { fontSize: 12, color: colors.muted },
  metaDot: { fontSize: 12, color: colors.line },
  descCard: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line,
  },
  descText: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  sectionTitle: { fontSize: 16, color: colors.ink, ...font.bold, marginTop: spacing.xs },
  emptyUpdates: { fontSize: 14, color: colors.muted },
  updatesList: { gap: spacing.sm },
  updateCard: {
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: 4,
  },
  updateMeta: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
  updateBody: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  replyBar: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line,
    alignItems: 'flex-end',
  },
  replyInput: {
    flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: spacing.sm, fontSize: 14, color: colors.ink,
    maxHeight: 100, backgroundColor: colors.paper,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenDark,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.line },
  sendBtnText: { color: colors.white, fontSize: 18, ...font.bold },
});
