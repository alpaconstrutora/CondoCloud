import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';
import { DOCUMENT_CATEGORIES } from '@condocloud/shared';
import type { Document, DocumentCategory, DocumentVisibility, DocumentsPage, DocumentUploadUrl } from '@condocloud/shared';

interface ApiResponse<T> { data: T }

// ── Upload para Supabase Storage via signed URL ───────────────
async function uploadToStorage(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage ${xhr.status}`))));
    xhr.addEventListener('error', () => reject(new Error('Falha no upload')));
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

// ── Modal de criação / nova versão ────────────────────────────
interface CreateModalProps {
  parentDoc?: Document;
  onClose: () => void;
  onCreated: () => void;
  isSindico: boolean;
}

function CreateModal({ parentDoc, onClose, onCreated, isSindico }: CreateModalProps) {
  const [title, setTitle] = useState(parentDoc?.title ?? '');
  const [category, setCategory] = useState<DocumentCategory>(parentDoc?.category ?? 'outro');
  const [visibleTo, setVisibleTo] = useState<DocumentVisibility>(parentDoc?.visible_to ?? 'all');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Preencha o título.'); return; }
    if (!file) { setError('Selecione um arquivo.'); return; }

    setLoading(true);
    setError('');
    try {
      // 1. Pedir signed upload URL
      const { data: uploadData } = await api.post<ApiResponse<DocumentUploadUrl>>('/documents/upload-url', {
        filename: file.name,
        content_type: file.type,
      });

      // 2. Upload binário direto ao Storage
      await uploadToStorage(uploadData.upload_url, file, setProgress);

      // 3. Registrar metadados na API
      // Supabase Storage não gera URL pública para bucket privado — usamos storage_path
      await api.post('/documents', {
        title: title.trim(),
        category,
        visible_to: visibleTo,
        file_url: uploadData.storage_path, // fallback para compatibilidade
        storage_path: uploadData.storage_path,
        file_size_bytes: file.size,
        ...(parentDoc ? { parent_id: parentDoc.id } : {}),
      });

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar documento');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {parentDoc ? `Nova versão — ${parentDoc.title}` : 'Enviar documento'}
        </h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ata AGO — 2026" />
          </div>
          {!parentDoc && (
            <div className={styles.field}>
              <label>Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {isSindico && (
            <div className={styles.field}>
              <label>Visibilidade</label>
              <select value={visibleTo} onChange={e => setVisibleTo(e.target.value as DocumentVisibility)}>
                <option value="all">Todos os moradores</option>
                <option value="sindico">Apenas síndico</option>
                <option value="admin">Síndico + administradora</option>
              </select>
            </div>
          )}
          <div className={styles.field}>
            <label>Arquivo *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <span className={styles.hint}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>}
          </div>
          {loading && progress > 0 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              <span className={styles.progressLabel}>{progress}%</span>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? (progress > 0 ? `Enviando ${progress}%…` : 'Salvando…') : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de versões ──────────────────────────────────────────
function VersionsModal({ doc, onClose, onNewVersion }: { doc: Document; onClose: () => void; onNewVersion: () => void }) {
  const [versions, setVersions] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<Document[]>>(`/documents/${doc.id}/versions`)
      .then(r => setVersions(r.data))
      .finally(() => setLoading(false));
  }, [doc.id]);

  async function openVersion(v: Document) {
    try {
      const { data } = await api.get<ApiResponse<{ url: string }>>(`/documents/${v.id}/download`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao abrir');
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 className={styles.modalTitle}>Histórico de versões</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{doc.title}</p>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Carregando…</p>
        ) : (
          <table className={styles.table} style={{ marginBottom: 16 }}>
            <thead><tr><th>Versão</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id}>
                  <td><span className={styles.badge}>v{v.version}</span></td>
                  <td className={styles.tdMuted}>{new Date(v.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <button className={`${styles.btnSmall} ${styles.btnSmallGreen}`} onClick={() => openVersion(v)}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Fechar</button>
          <button className={styles.btnPrimary} onClick={onNewVersion}>+ Nova versão</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Documents() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newVersionFor, setNewVersionFor] = useState<Document | null>(null);
  const [versionsFor, setVersionsFor] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (filter) params.set('category', filter);
      const res = await api.get<ApiResponse<DocumentsPage>>(`/documents?${params}`);
      setDocs(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); load(1); }, [filter]);
  useEffect(() => { load(page); }, [page]);

  async function openDoc(doc: Document) {
    try {
      const { data } = await api.get<ApiResponse<{ url: string }>>(`/documents/${doc.id}/download`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao abrir documento');
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm('Remover este documento?')) return;
    setDeleting(id);
    try {
      await api.delete(`/documents/${id}`);
      load(page);
    } finally {
      setDeleting(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal
          isSindico={isSindico}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(page); }}
        />
      )}
      {newVersionFor && (
        <CreateModal
          parentDoc={newVersionFor}
          isSindico={isSindico}
          onClose={() => setNewVersionFor(null)}
          onCreated={() => { setNewVersionFor(null); load(page); }}
        />
      )}
      {versionsFor && (
        <VersionsModal
          doc={versionsFor}
          onClose={() => setVersionsFor(null)}
          onNewVersion={() => { setNewVersionFor(versionsFor); setVersionsFor(null); }}
        />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Documentos</h1>
          <p className={styles.subtitle}>Acesse atas, regulamentos, contratos e outros arquivos.</p>
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
        {DOCUMENT_CATEGORIES.map(c => (
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
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoria</th>
                  <th>Versão</th>
                  <th>Publicado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.title}</td>
                    <td>
                      <span className={styles.badge} style={{ background: '#f0ece4', color: 'var(--muted)' }}>
                        {d.category}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{ background: '#e8f5e9', color: '#388e3c', cursor: d.version > 1 ? 'pointer' : 'default' }}
                        onClick={() => d.version > 1 && setVersionsFor(d)}
                        title={d.version > 1 ? 'Ver histórico de versões' : undefined}
                      >
                        v{d.version}
                      </span>
                    </td>
                    <td className={styles.tdMuted}>{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className={`${styles.btnSmall} ${styles.btnSmallGreen}`} onClick={() => openDoc(d)}>
                        Abrir
                      </button>
                      {isSindico && (
                        <>
                          <button
                            className={`${styles.btnSmall}`}
                            style={{ background: '#e8f5e9', color: '#388e3c', border: '1px solid #c8e6c9' }}
                            onClick={() => setVersionsFor(d)}
                          >
                            Versões
                          </button>
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallRed}`}
                            onClick={() => deleteDoc(d.id)}
                            disabled={deleting === d.id}
                          >
                            {deleting === d.id ? '…' : 'Remover'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.btnSecondary}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Anterior
              </button>
              <span className={styles.tdMuted}>Página {page} de {totalPages} ({total} documentos)</span>
              <button
                className={styles.btnSecondary}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
