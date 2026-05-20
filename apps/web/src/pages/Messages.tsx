import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface Message {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  profiles?: { name: string };
}

interface ApiResponse<T> { data: T }

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('Preencha título e mensagem.'); return; }
    setLoading(true);
    try {
      await api.post('/messages', { title, body, is_pinned: pinned });
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
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Manutenção do elevador — 22/04" />
          </div>
          <div className={styles.field}>
            <label>Mensagem *</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Informamos que..."
              style={{ minHeight: 120 }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
            Fixar no topo
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Publicando…' : 'Publicar comunicado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Messages() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Message[]>>('/messages');
      setMessages(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function deleteMsg(id: string) {
    if (!confirm('Remover este comunicado?')) return;
    setDeleting(id);
    try {
      await api.delete(`/messages/${id}`);
      load();
    } finally {
      setDeleting(null);
    }
  }

  async function markRead(id: string) {
    await api.post(`/messages/${id}/read`, {});
  }

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
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
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : messages.length === 0 ? (
        <div className={styles.empty}>
          <span>💬</span>
          <p>Nenhum comunicado publicado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(m => (
            <div
              key={m.id}
              className={styles.detailCard}
              onClick={() => markRead(m.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.is_pinned && (
                    <span className={styles.badge} style={{ background: '#16a86920', color: 'var(--green-dark)', fontSize: 11 }}>📌 Fixado</span>
                  )}
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{m.title}</h3>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {isSindico && (
                    <button
                      className={`${styles.btnSmall} ${styles.btnSmallRed}`}
                      onClick={e => { e.stopPropagation(); deleteMsg(m.id); }}
                      disabled={deleting === m.id}
                    >
                      {deleting === m.id ? '…' : 'Remover'}
                    </button>
                  )}
                </div>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{m.body}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                {m.profiles?.name ?? 'Síndico'} · {new Date(m.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
