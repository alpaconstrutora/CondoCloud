import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';

interface Vendor {
  id: string;
  company_name?: string;
  document?: string;
  specialty: string;
  phone?: string;
  email?: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

interface ApiResponse<T> { data: T }

function VendorModal({ onClose, onSaved, initial }: {
  onClose: () => void;
  onSaved: () => void;
  initial?: Vendor;
}) {
  const [companyName, setCompanyName] = useState(initial?.company_name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [document, setDocument] = useState(initial?.document ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!initial;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!specialty.trim()) { setError('Especialidade é obrigatória.'); return; }
    setLoading(true);
    try {
      const payload = {
        company_name: companyName || undefined,
        specialty,
        document: document || undefined,
        phone: phone || undefined,
        email: email || undefined,
      };
      if (isEdit) {
        await api.patch(`/vendors/${initial.id}`, payload);
      } else {
        await api.post('/vendors', payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Empresa / Nome</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Hidra Serviços Ltda" />
            </div>
            <div className={styles.field}>
              <label>Especialidade *</label>
              <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Hidráulica, elétrica…" />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>CPF / CNPJ</label>
              <input value={document} onChange={e => setDocument(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className={styles.field}>
              <label>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className={styles.field}>
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Vendor[]>>('/vendors');
      setVendors(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Excluir este fornecedor?')) return;
    await api.delete(`/vendors/${id}`);
    load();
  }

  return (
    <div className={styles.page}>
      {modal.open && (
        <VendorModal
          initial={modal.vendor}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
        />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Fornecedores</h1>
          <p className={styles.subtitle}>Cadastre prestadores de serviço do condomínio.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setModal({ open: true })}>+ Fornecedor</button>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className={styles.empty}>
          <span>🔧</span>
          <p>Nenhum fornecedor cadastrado.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empresa / Nome</th>
                <th>Especialidade</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Avaliação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.company_name ?? '—'}</td>
                  <td className={styles.tdMono}>{v.specialty}</td>
                  <td className={styles.tdMuted}>{v.phone ?? '—'}</td>
                  <td className={styles.tdMuted}>{v.email ?? '—'}</td>
                  <td className={styles.tdMuted}>
                    {v.rating_count > 0 ? `${v.rating_avg.toFixed(1)} ⭐ (${v.rating_count})` : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className={styles.iconBtn} title="Editar" onClick={() => setModal({ open: true, vendor: v })}>✏️</button>
                    <button className={styles.iconBtn} title="Excluir" onClick={() => handleDelete(v.id)}>🗑️</button>
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
