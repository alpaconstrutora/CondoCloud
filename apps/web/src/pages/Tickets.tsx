import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import styles from './modules.module.css';

interface Ticket {
  id: string;
  title: string;
  description: string;
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
  open: '#E5257A', in_progress: '#F59E0B', resolved: '#16A869', closed: '#9ca3af',
};
const PRIORITY_LABEL = ['', 'Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];
const CATEGORIES = ['hidraulica', 'eletrica', 'estrutural', 'limpeza', 'seguranca', 'outro'];
const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abertos' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvidos' },
];

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('outro');
  const [priority, setPriority] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setLoading(true);
    try {
      await api.post('/tickets', { title, description, category, priority });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar chamado');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Novo chamado</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Vazamento no corredor do 3º andar" />
          </div>
          <div className={styles.field}>
            <label>Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o problema..." />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Prioridade</label>
              <select value={priority} onChange={e => setPriority(Number(e.target.value))}>
                {[1,2,3,4,5].map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando…' : 'Criar chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Ticket[]>>(filter ? `/tickets?status=${filter}` : '/tickets');
      setTickets(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Chamados</h1>
          <p className={styles.subtitle}>Gerencie ocorrências e manutenções do condomínio.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Novo chamado</button>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className={styles.empty}>
          <span>🎫</span>
          <p>Nenhum chamado encontrado.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Chamado</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td className={styles.tdTitle}>
                    <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                  </td>
                  <td className={styles.tdMono}>{t.category}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: t.priority >= 4 ? '#E5257A' : t.priority >= 3 ? '#F59E0B' : '#16A869' }}>
                    {PRIORITY_LABEL[t.priority] ?? t.priority}
                  </td>
                  <td>
                    <span className={styles.badge} style={{ background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className={styles.tdMuted}>{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
