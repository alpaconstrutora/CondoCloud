import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface AssemblyItem {
  id: string;
  title: string;
  description?: string;
  order_index: number;
}

interface VoteSummary {
  yes: number;
  no: number;
  abstain: number;
  total: number;
}

interface Assembly {
  id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  status: 'draft' | 'open' | 'closed';
  assembly_items?: AssemblyItem[];
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', open: 'Votação aberta', closed: 'Encerrada' };
const STATUS_COLOR: Record<string, string> = { draft: '#9ca3af', open: '#16A869', closed: '#E5257A' };

function AddItemModal({ assemblyId, onClose, onAdded }: { assemblyId: string; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setLoading(true);
    try {
      await api.post(`/assemblies/${assemblyId}/items`, { title, description });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar pauta');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Adicionar pauta</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Aprovação do orçamento 2026" />
          </div>
          <div className={styles.field}>
            <label>Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes sobre a pauta..." />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Adicionando…' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VotePanel({ assemblyId, itemId, isOpen }: { assemblyId: string; itemId: string; isOpen: boolean }) {
  const [summary, setSummary] = useState<VoteSummary | null>(null);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<VoteSummary>>(`/assemblies/${assemblyId}/items/${itemId}/votes`)
      .then(res => setSummary(res.data))
      .catch(() => {});
  }, [assemblyId, itemId, voted]);

  async function vote(choice: 'yes' | 'no' | 'abstain') {
    setVoting(true);
    try {
      await api.post(`/assemblies/${assemblyId}/items/${itemId}/vote`, { vote: choice });
      setVoted(true);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {summary && (
        <div style={{ display: 'flex', gap: 12, fontSize: 13, fontFamily: 'var(--mono)' }}>
          <span style={{ color: '#16A869' }}>✓ {summary.yes} sim</span>
          <span style={{ color: '#E5257A' }}>✗ {summary.no} não</span>
          <span style={{ color: '#9ca3af' }}>— {summary.abstain} abstençõe{summary.abstain !== 1 ? 's' : ''}</span>
        </div>
      )}
      {isOpen && !voted && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`${styles.btnSmall} ${styles.btnSmallGreen}`} onClick={() => vote('yes')} disabled={voting}>Sim</button>
          <button className={`${styles.btnSmall} ${styles.btnSmallRed}`} onClick={() => vote('no')} disabled={voting}>Não</button>
          <button className={styles.btnSmall} style={{ background: '#f0ece4', color: 'var(--muted)' }} onClick={() => vote('abstain')} disabled={voting}>Abster</button>
        </div>
      )}
      {voted && <span style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 600 }}>✓ Voto registrado</span>}
    </div>
  );
}

export default function AssemblyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load() {
    if (!id) return;
    try {
      const res = await api.get<ApiResponse<Assembly>>(`/assemblies/${id}`);
      setAssembly(res.data);
    } catch {
      navigate('/assemblies', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function toggleStatus() {
    if (!assembly || !id) return;
    if (assembly.status === 'draft') await api.patch(`/assemblies/${id}/open`, {});
    else if (assembly.status === 'open') await api.patch(`/assemblies/${id}/close`, {});
    load();
  }

  if (loading || !assembly) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  const items = assembly.assembly_items ?? [];

  return (
    <div className={styles.page}>
      {showAddItem && id && (
        <AddItemModal assemblyId={id} onClose={() => setShowAddItem(false)} onAdded={() => { setShowAddItem(false); load(); }} />
      )}

      <Link to="/assemblies" className={styles.backLink}>← Assembleias</Link>

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>{assembly.title}</h1>
          <p className={styles.subtitle}>
            {new Date(assembly.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className={styles.badge} style={{ background: `${STATUS_COLOR[assembly.status]}20`, color: STATUS_COLOR[assembly.status], fontSize: 14, padding: '6px 16px' }}>
            {STATUS_LABEL[assembly.status]}
          </span>
          {isSindico && assembly.status !== 'closed' && (
            <button
              className={`${styles.btnSmall} ${assembly.status === 'draft' ? styles.btnSmallGreen : styles.btnSmallRed}`}
              onClick={toggleStatus}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {assembly.status === 'draft' ? 'Abrir votação' : 'Encerrar'}
            </button>
          )}
        </div>
      </div>

      {assembly.description && (
        <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{assembly.description}</p>
      )}

      {/* Pautas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Pautas</h2>
          {isSindico && assembly.status !== 'closed' && (
            <button className={styles.btnPrimary} style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => setShowAddItem(true)}>
              + Pauta
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <span>🗳️</span>
            <p>Nenhuma pauta adicionada ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, idx) => (
              <div key={item.id} className={styles.detailCard}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)', fontWeight: 700, marginTop: 2, flexShrink: 0 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--ink)' }}>{item.title}</h3>
                    {item.description && (
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.5 }}>{item.description}</p>
                    )}
                    {id && <VotePanel assemblyId={id} itemId={item.id} isOpen={assembly.status === 'open'} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
