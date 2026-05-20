import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface Document {
  id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

interface ApiResponse<T> { data: T }

const CATEGORIES = ['ata', 'regulamento', 'balancete', 'contrato', 'laudo', 'circular', 'outro'];

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('outro');
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) { setError('Preencha título e URL do arquivo.'); return; }
    setLoading(true);
    try {
      await api.post('/documents', { title, category, file_url: fileUrl });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar documento');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Cadastrar documento</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ata AGO — 2026" />
          </div>
          <div className={styles.field}>
            <label>Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>URL do arquivo *</label>
            <input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." type="url" />
            <span className={styles.hint}>Faça upload no Supabase Storage e cole o link público aqui.</span>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Documents() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Document[]>>(filter ? `/documents?category=${filter}` : '/documents');
      setDocs(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function deleteDoc(id: string) {
    if (!confirm('Remover este documento?')) return;
    setDeleting(id);
    try {
      await api.delete(`/documents/${id}`);
      load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Documentos</h1>
          <p className={styles.subtitle}>Acesse atas, regulamentos, balancetes e outros arquivos.</p>
        </div>
        {isSindico && (
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Documento</button>
        )}
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === '' ? styles.filterActive : ''}`}
          onClick={() => setFilter('')}
        >
          Todos
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`${styles.filterBtn} ${filter === c ? styles.filterActive : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : docs.length === 0 ? (
        <div className={styles.empty}>
          <span>📁</span>
          <p>Nenhum documento encontrado.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Publicado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                      {d.title}
                    </a>
                  </td>
                  <td><span className={styles.badge} style={{ background: '#f0ece4', color: 'var(--muted)' }}>{d.category}</span></td>
                  <td className={styles.tdMuted}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <button className={`${styles.btnSmall} ${styles.btnSmallGreen}`}>Abrir</button>
                    </a>
                    {isSindico && (
                      <button
                        className={`${styles.btnSmall} ${styles.btnSmallRed}`}
                        onClick={() => deleteDoc(d.id)}
                        disabled={deleting === d.id}
                      >
                        {deleting === d.id ? '…' : 'Remover'}
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
