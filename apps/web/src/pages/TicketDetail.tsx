import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface TicketUpdate {
  id: string;
  content: string;
  created_at: string;
  profiles?: { name: string };
}

interface Ticket {
  id: string;
  title: string;
  description: string;
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
  open: '#E5257A', in_progress: '#F59E0B', resolved: '#16A869', closed: '#9ca3af',
};
const PRIORITY_LABEL = ['', 'Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateContent, setUpdateContent] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load() {
    if (!id) return;
    try {
      const res = await api.get<ApiResponse<Ticket>>(`/tickets/${id}`);
      setTicket(res.data);
      setNewStatus(res.data.status);
    } catch {
      navigate('/tickets', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddUpdate(e: FormEvent) {
    e.preventDefault();
    if (!updateContent.trim() || !id) return;
    setUpdating(true);
    try {
      await api.post(`/tickets/${id}/updates`, { content: updateContent });
      setUpdateContent('');
      load();
    } finally {
      setUpdating(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!id) return;
    await api.patch(`/tickets/${id}`, { status });
    setNewStatus(status);
    load();
  }

  if (loading || !ticket) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/tickets" className={styles.backLink}>← Chamados</Link>

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{ticket.title}</h1>
          <p className={styles.subtitle}>#{ticket.id.slice(0, 8)} · {ticket.category}</p>
        </div>
        <span className={styles.badge} style={{ background: `${STATUS_COLOR[ticket.status]}20`, color: STATUS_COLOR[ticket.status], fontSize: 14, padding: '6px 16px' }}>
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <div className={styles.detailGrid}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ticket.description && (
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Descrição</h3>
              <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{ticket.description}</p>
            </div>
          )}

          <div className={styles.detailCard}>
            <h3 className={styles.detailCardTitle}>Atualizações</h3>
            <div className={styles.updates}>
              {(!ticket.ticket_updates || ticket.ticket_updates.length === 0) ? (
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nenhuma atualização ainda.</p>
              ) : (
                ticket.ticket_updates.map(u => (
                  <div key={u.id} className={styles.updateItem}>
                    <div className={styles.updateMeta}>
                      {u.profiles?.name ?? 'Usuário'} · {new Date(u.created_at).toLocaleString('pt-BR')}
                    </div>
                    <div className={styles.updateBody}>{u.content}</div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleAddUpdate} style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <input
                value={updateContent}
                onChange={e => setUpdateContent(e.target.value)}
                placeholder="Adicionar atualização…"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
              />
              <button type="submit" className={styles.btnPrimary} disabled={updating || !updateContent.trim()}>
                {updating ? '…' : 'Enviar'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Detalhes</h3>
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Prioridade</span>
              <span className={styles.metaVal}>{PRIORITY_LABEL[ticket.priority]}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Categoria</span>
              <span className={styles.metaVal}>{ticket.category}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Aberto em</span>
              <span className={styles.metaVal}>{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {isSindico && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
              <p style={{ fontSize: 12, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Alterar status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={styles.filterBtn}
                    style={{ borderRadius: 8, textAlign: 'left', padding: '8px 12px' }}
                  >
                    {newStatus === s ? '● ' : '○ '}{STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
