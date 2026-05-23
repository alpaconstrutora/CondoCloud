import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';
import type { MessageWithMeta, MessagesPage } from '@condocloud/shared';

interface ApiResponse<T> { data: T }
interface Block { id: string; name: string }
interface Unit { id: string; number: string; block_id?: string }

const PAGE_SIZE = 20;

// ── Modal de criação ──────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [audience, setAudience] = useState<'all' | 'block' | 'unit'>('all');
  const [targetId, setTargetId] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ApiResponse<Block[]>>('/condominium/blocks').then(r => setBlocks(r.data)).catch(() => {});
    api.get<ApiResponse<Unit[]>>('/condominium/units').then(r => setUnits(r.data)).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError('Preencha título e mensagem.'); return; }
    if (audience !== 'all' && !targetId) { setError('Selecione o destino.'); return; }
    setLoading(true);
    try {
      await api.post('/messages', {
        title: title.trim(),
        content: content.trim(),
        pinned,
        audience,
        target_id: audience !== 'all' ? targetId : undefined,
        publish_at: publishAt || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar aviso');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo comunicado</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Manutenção do elevador — 22/05" />
          </div>
          <div className={styles.field}>
            <label>Mensagem *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Informamos que..." style={{ minHeight: 120 }} />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Destinatário</label>
              <select value={audience} onChange={e => { setAudience(e.target.value as 'all' | 'block' | 'unit'); setTargetId(''); }}>
                <option value="all">Todos os moradores</option>
                <option value="block">Bloco específico</option>
                <option value="unit">Unidade específica</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Agendar publicação</label>
              <input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} />
            </div>
          </div>
          {audience === 'block' && (
            <div className={styles.field}>
              <label>Bloco *</label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">Selecione o bloco</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {audience === 'unit' && (
            <div className={styles.field}>
              <label>Unidade *</label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">Selecione a unidade</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.number}</option>)}
              </select>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            Fixar no topo
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Publicando…' : (publishAt ? 'Agendar' : 'Publicar comunicado')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de leituras (síndico) ───────────────────────────────
interface ReadEntry { profile_id: string; name: string; read_at: string }

function ReadsModal({ messageId, title, onClose }: { messageId: string; title: string; onClose: () => void }) {
  const [reads, setReads] = useState<ReadEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<ReadEntry[]>>(`/messages/${messageId}/reads`)
      .then(r => setReads(r.data))
      .finally(() => setLoading(false));
  }, [messageId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 className={styles.modalTitle}>Confirmações de leitura</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{title}</p>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Carregando…</p>
        ) : reads.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nenhum morador leu ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {reads.map(r => (
              <div key={r.profile_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: 'var(--muted)' }}>{new Date(r.read_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            ))}
          </div>
        )}
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Messages() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [readsFor, setReadsFor] = useState<MessageWithMeta | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<MessagesPage>>(`/messages?page=${p}&page_size=${PAGE_SIZE}`);
      setMessages(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page]);

  async function markRead(id: string) {
    await api.post(`/messages/${id}/read`, {}).catch(() => {});
    setMessages(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m));
  }

  async function deleteMsg(id: string) {
    if (!confirm('Remover este comunicado?')) return;
    setDeleting(id);
    try {
      await api.delete(`/messages/${id}`);
      load(page);
    } finally {
      setDeleting(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const audienceLabel: Record<string, string> = { all: '', block: 'Bloco', unit: 'Unidade' };

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(1); setPage(1); }} />
      )}
      {readsFor && (
        <ReadsModal messageId={readsFor.id} title={readsFor.title} onClose={() => setReadsFor(null)} />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Comunicados</h1>
          <p className={styles.subtitle}>Avisos e informações para os moradores do condomínio.</p>
        </div>
        {isSindico && (
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Comunicado</button>
        )}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} style={{ height: 100 }} />)}
        </div>
      ) : messages.length === 0 ? (
        <div className={styles.empty}>
          <span>💬</span>
          <p>Nenhum comunicado publicado.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(m => (
              <div
                key={m.id}
                className={styles.detailCard}
                onClick={() => { if (m.unread) markRead(m.id); }}
                style={{ cursor: m.unread ? 'pointer' : 'default', borderLeft: m.unread ? '3px solid var(--green)' : '3px solid transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {m.pinned && (
                      <span className={styles.badge} style={{ background: '#16a86920', color: 'var(--green-dark)', fontSize: 11 }}>📌 Fixado</span>
                    )}
                    {m.unread && (
                      <span className={styles.badge} style={{ background: '#1a73e820', color: '#1a73e8', fontSize: 11 }}>Não lido</span>
                    )}
                    {m.audience !== 'all' && (
                      <span className={styles.badge} style={{ background: '#f0ece4', color: 'var(--muted)', fontSize: 11 }}>
                        {audienceLabel[m.audience]}
                      </span>
                    )}
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{m.title}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {isSindico && (
                      <>
                        <button
                          className={styles.btnSmall}
                          style={{ background: '#e8f5e9', color: '#388e3c', border: '1px solid #c8e6c9' }}
                          onClick={e => { e.stopPropagation(); setReadsFor(m); }}
                          title={`${m.read_count} leitura(s)`}
                        >
                          👁 {m.read_count}
                        </button>
                        <button
                          className={`${styles.btnSmall} ${styles.btnSmallRed}`}
                          onClick={e => { e.stopPropagation(); deleteMsg(m.id); }}
                          disabled={deleting === m.id}
                        >
                          {deleting === m.id ? '…' : 'Remover'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                  {m.profiles?.name ?? 'Síndico'} · {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.btnSecondary} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Anterior</button>
              <span className={styles.tdMuted}>Página {page} de {totalPages} ({total} comunicados)</span>
              <button className={styles.btnSecondary} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
