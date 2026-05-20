import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import styles from './modules.module.css';

interface Assembly {
  id: string;
  title: string;
  scheduled_at: string;
  status: 'draft' | 'open' | 'closed';
  description?: string;
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', open: 'Votação aberta', closed: 'Encerrada' };
const STATUS_COLOR: Record<string, string> = { draft: '#9ca3af', open: '#16A869', closed: '#E5257A' };

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !scheduledAt) { setError('Preencha título e data.'); return; }
    setLoading(true);
    try {
      await api.post('/assemblies', { title, scheduled_at: scheduledAt, description });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar assembleia');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Nova assembleia</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Assembleia Ordinária — 2º semestre" />
          </div>
          <div className={styles.field}>
            <label>Data e hora *</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Pauta e informações gerais..." />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando…' : 'Criar assembleia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Assemblies() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Assembly[]>>('/assemblies');
      setAssemblies(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(a: Assembly) {
    if (a.status === 'draft') await api.patch(`/assemblies/${a.id}/open`, {});
    else if (a.status === 'open') await api.patch(`/assemblies/${a.id}/close`, {});
    load();
  }

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Assembleias</h1>
          <p className={styles.subtitle}>Organize assembleias e colete votos dos moradores.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nova assembleia</button>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : assemblies.length === 0 ? (
        <div className={styles.empty}>
          <span>🗳️</span>
          <p>Nenhuma assembleia criada.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Assembleia</th>
                <th>Data</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assemblies.map(a => (
                <tr key={a.id}>
                  <td className={styles.tdTitle}>
                    <Link to={`/assemblies/${a.id}`}>{a.title}</Link>
                  </td>
                  <td className={styles.tdMuted}>{new Date(a.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    <span className={styles.badge} style={{ background: `${STATUS_COLOR[a.status]}20`, color: STATUS_COLOR[a.status] }}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td>
                    {a.status !== 'closed' && (
                      <button
                        className={`${styles.btnSmall} ${a.status === 'draft' ? styles.btnSmallGreen : styles.btnSmallRed}`}
                        onClick={() => toggleStatus(a)}
                      >
                        {a.status === 'draft' ? 'Abrir votação' : 'Encerrar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
