import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';
import { printReceipt, printCarnet, type ChargeDoc } from '../utils/reports';

interface Charge {
  id: string;
  unit_id: string;
  profile_id?: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  description: string;
  competencia?: string;
  paid_at?: string;
  payment_method?: string;
  units?: { number: string; blocks?: { name: string } };
  profiles?: {
    name: string;
    unit_profiles?: { units?: { number: string; blocks?: { name: string } } | null }[];
  } | null;
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Em atraso', cancelled: 'Cancelada' };
const STATUS_COLOR: Record<string, string> = { pending: '#F59E0B', paid: '#16A869', overdue: '#E5257A', cancelled: '#9CA3AF' };

const FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'paid', label: 'Pagas' },
  { value: 'cancelled', label: 'Canceladas' },
];

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!unitId.trim() || !amount || !dueDate) { setError('Preencha unidade, valor e vencimento.'); return; }
    setLoading(true);
    try {
      await api.post('/charges', { unit_id: unitId, amount: Number(amount), due_date: dueDate, description });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cobrança');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Nova cobrança</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>ID da unidade *</label>
            <input value={unitId} onChange={e => setUnitId(e.target.value)} placeholder="UUID da unidade" />
            <span className={styles.hint}>ID da unidade no sistema (visível nas configurações)</span>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Valor (R$) *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="850,00" />
            </div>
            <div className={styles.field}>
              <label>Vencimento *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label>Descrição</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Taxa condominial — julho/2026" />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Criando…' : 'Criar cobrança'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Charges() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [filter, setFilter] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [unmarking, setUnmarking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [condoName, setCondoName] = useState('');

  useEffect(() => {
    api.get<ApiResponse<{ name: string }>>('/condominium')
      .then(r => { if (r.data?.name) setCondoName(r.data.name); })
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      if (competencia) params.set('competencia', competencia);
      const qs = params.toString();
      const res = await api.get<ApiResponse<Charge[]>>(`/charges${qs ? `?${qs}` : ''}`);
      setCharges(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter, competencia]);

  async function markPaid(id: string) {
    setMarkingPaid(id);
    try {
      await api.patch(`/charges/${id}/pay`, {});
      load();
    } finally {
      setMarkingPaid(null);
    }
  }

  async function unmarkPaid(id: string) {
    if (!confirm('Cancelar o pagamento desta cobrança? Ela voltará para pendente ou em atraso.')) return;
    setUnmarking(id);
    try {
      await api.patch(`/charges/${id}/unpay`, {});
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar pagamento');
    } finally {
      setUnmarking(null);
    }
  }

  async function cancelCharge(id: string) {
    if (!confirm('Cancelar esta cobrança?')) return;
    setCancelling(id);
    try {
      await api.patch(`/charges/${id}/cancel`, {});
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setCancelling(null);
    }
  }

  async function cancelByCompetencia(competencia: string) {
    const mes = competencia.slice(0, 7);
    if (!confirm(`Cancelar TODAS as cobranças de ${mes} (exceto pagas)?`)) return;
    try {
      await api.patch(`/charges/cancel-by-competencia/${mes}`, {});
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar cobranças');
    }
  }

  // Competências únicas presentes na listagem atual (para botão de cancelar lote)
  const competencias = [...new Set(
    charges.filter(c => c.competencia && c.status !== 'paid' && c.status !== 'cancelled')
      .map(c => c.competencia!)
  )];

  function toChargeDoc(c: Charge, unitLabelStr: string): ChargeDoc {
    return {
      id: c.id,
      description: c.description || '—',
      amount: c.amount,
      due_date: c.due_date,
      competencia: c.competencia,
      status: c.status,
      paid_at: c.paid_at,
      payment_method: c.payment_method,
      unitLabel: unitLabelStr,
      residentName: c.profiles?.name ?? '—',
    };
  }

  const totalPending = charges.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const totalOverdue = charges.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Cobranças</h1>
          <p className={styles.subtitle}>Gerencie taxas condominiais e outras cobranças.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {competencias.map(comp => (
            <button key={comp} className={styles.btnSecondary}
              style={{ fontSize: '0.8rem', color: '#c0334d', borderColor: '#c0334d' }}
              onClick={() => cancelByCompetencia(comp)}>
              🚫 Cancelar lote {comp.slice(0, 7)}
            </button>
          ))}
          {charges.some(c => c.status === 'pending' || c.status === 'overdue') && (
            <button className={styles.btnSecondary} style={{ fontSize: '0.8rem' }}
              onClick={() => {
                const pending = charges.filter(c => c.status === 'pending' || c.status === 'overdue');
                const docs = pending.map(c => {
                  const allUnits = c.profiles?.unit_profiles?.length
                    ? c.profiles.unit_profiles.map(up => up.units).filter(Boolean).map(u => `${u!.blocks?.name ? `${u!.blocks.name} · ` : ''}${u!.number}`)
                    : c.units ? [`${c.units.blocks?.name ? `${c.units.blocks.name} · ` : ''}${c.units.number}`] : [];
                  return toChargeDoc(c, allUnits.join(', ') || '—');
                });
                printCarnet(docs, condoName);
              }}>
              🖨️ Carnê em lote
            </button>
          )}
          {charges.some(c => c.status === 'paid') && (
            <button className={styles.btnSecondary} style={{ fontSize: '0.8rem' }}
              onClick={() => {
                const paid = charges.filter(c => c.status === 'paid');
                const docs = paid.map(c => {
                  const allUnits = c.profiles?.unit_profiles?.length
                    ? c.profiles.unit_profiles.map(up => up.units).filter(Boolean).map(u => `${u!.blocks?.name ? `${u!.blocks.name} · ` : ''}${u!.number}`)
                    : c.units ? [`${c.units.blocks?.name ? `${c.units.blocks.name} · ` : ''}${c.units.number}`] : [];
                  return toChargeDoc(c, allUnits.join(', ') || '—');
                });
                printReceipt(docs, condoName);
              }}>
              🧾 Recibos em lote
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nova cobrança</button>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Pendentes</span>
          <span className={`${styles.summaryValue} ${styles.summaryAmber}`}>{fmt(totalPending)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Em atraso</span>
          <span className={`${styles.summaryValue} ${styles.summaryRed}`}>{fmt(totalOverdue)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total listado</span>
          <span className={styles.summaryValue}>{charges.length} cobranças</span>
        </div>
      </div>

      <div className={styles.filters} style={{ gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Competência:</label>
          <input
            type="month"
            value={competencia}
            onChange={e => setCompetencia(e.target.value)}
            style={{ fontSize: '0.85rem', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
          />
          {competencia && (
            <button
              onClick={() => setCompetencia('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1 }}
              title="Limpar filtro de competência"
            >✕</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : charges.length === 0 ? (
        <div className={styles.empty}>
          <span>📄</span>
          <p>Nenhuma cobrança encontrada.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Unidade</th>
                <th>Morador</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {charges.map(c => {
                // Se a cobrança tem morador, mostrar todas as unidades dele
                // Caso contrário, mostrar a unidade direta da cobrança
                const allUnits = c.profiles?.unit_profiles?.length
                  ? c.profiles.unit_profiles
                      .map(up => up.units)
                      .filter(Boolean)
                      .map(u => `${u!.blocks?.name ? `${u!.blocks.name} · ` : ''}${u!.number}`)
                  : c.units
                    ? [`${c.units.blocks?.name ? `${c.units.blocks.name} · ` : ''}${c.units.number}`]
                    : [];
                const unitLabel = allUnits.length ? allUnits.join(', ') : '—';
                return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.description || '—'}</td>
                  <td className={styles.tdMuted}>{unitLabel}</td>
                  <td className={styles.tdMuted}>{c.profiles?.name ?? '—'}</td>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(c.amount)}</td>
                  <td className={styles.tdMuted}>{new Date(c.due_date).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span className={styles.badge} style={{ background: `${STATUS_COLOR[c.status]}20`, color: STATUS_COLOR[c.status] }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {(c.status === 'pending' || c.status === 'overdue') && (
                      <>
                        <button
                          className={`${styles.btnSmall} ${styles.btnSmallGreen}`}
                          onClick={() => markPaid(c.id)}
                          disabled={markingPaid === c.id}
                        >
                          {markingPaid === c.id ? '…' : 'Marcar pago'}
                        </button>
                        <button
                          className={styles.btnSmall}
                          style={{ background: '#e0f2fe', color: '#0369a1', border: 'none' }}
                          onClick={() => printCarnet([toChargeDoc(c, unitLabel)], condoName)}
                          title="Imprimir carnê"
                        >
                          🖨️
                        </button>
                        <button
                          className={styles.btnSmall}
                          style={{ background: '#fee2e2', color: '#c0334d', border: 'none' }}
                          onClick={() => cancelCharge(c.id)}
                          disabled={cancelling === c.id}
                        >
                          {cancelling === c.id ? '…' : 'Cancelar'}
                        </button>
                      </>
                    )}
                    {c.status === 'paid' && (
                      <>
                        <button
                          className={styles.btnSmall}
                          style={{ background: '#dcfce7', color: '#15803d', border: 'none' }}
                          onClick={() => printReceipt([toChargeDoc(c, unitLabel)], condoName)}
                          title="Imprimir recibo"
                        >
                          🧾
                        </button>
                        <button
                          className={styles.btnSmall}
                          style={{ background: '#fef3c7', color: '#92400e', border: 'none' }}
                          onClick={() => unmarkPaid(c.id)}
                          disabled={unmarking === c.id}
                        >
                          {unmarking === c.id ? '…' : 'Desfazer pagamento'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
