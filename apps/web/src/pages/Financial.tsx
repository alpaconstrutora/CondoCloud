import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';
import { printRateioReport } from '../utils/reports';

interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  due_date?: string;
  competencia?: string;
  receipt_url?: string;
  created_at: string;
}

interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
  saldo_anterior: number;
  pending_count: number;
}

interface Closing {
  id: string;
  competencia: string;
  closed_at: string;
  saldo_inicial: number;
  total_income: number;
  total_expense: number;
  saldo_final: number;
  notes: string | null;
}

interface ApiResponse<T> { data: T }

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Recurring {
  id: string;
  description: string;
  category: string;
  amount: number;
  day_of_month: number;
  active: boolean;
  last_generated: string | null;
}

interface Unit {
  id: string;
  number: string;
  block_id: string;
  size_sqm?: number;
  blocks?: { id: string; name: string };
  unit_profiles?: { profile_id: string; is_responsible: boolean; profiles?: { id: string; name?: string } }[];
}

type RateioMethod = 'igualitario' | 'fracaoIdeal' | 'consumoIndividual' | 'misto';

const RATEIO_DESCRIPTIONS: Record<RateioMethod, string> = {
  igualitario: 'Todos pagam o mesmo valor, independentemente do tamanho da unidade.',
  fracaoIdeal: 'Cada unidade paga proporcionalmente à sua área em relação ao total (conforme Código Civil).',
  consumoIndividual: 'Custo base rateado igualmente + consumo individual informado por unidade (água, gás, etc.).',
  misto: 'Cada categoria de despesa pode usar um método diferente (igualitário ou fração ideal).',
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmt(v: number | null | undefined) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Record Modal ──────────────────────────────────────────────────

interface RecordFormProps {
  onClose: () => void;
  onSaved: () => void;
  initial?: FinancialRecord;
  defaultCompetencia: string;
}

function RecordModal({ onClose, onSaved, initial, defaultCompetencia }: RecordFormProps) {
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.due_date ?? new Date().toISOString().slice(0, 10));
  const [competencia, setCompetencia] = useState(
    initial?.competencia ? initial.competencia.slice(0, 7) : defaultCompetencia
  );
  const [receiptUrl, setReceiptUrl] = useState(initial?.receipt_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const cats = categories.filter(c => c.type === type);
  const isEdit = !!initial;

  useEffect(() => {
    api.get<ApiResponse<Category[]>>('/financial/categories')
      .then(r => {
        setCategories(r.data ?? []);
        if (!initial?.category) {
          const first = (r.data ?? []).find(c => c.type === type);
          if (first) setCategory(first.name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const first = cats[0];
    if (first && !cats.find(c => c.name === category)) setCategory(first.name);
  }, [type, categories]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from('financial-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from('financial-attachments').getPublicUrl(path);
      setReceiptUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount) { setError('Preencha descrição e valor.'); return; }
    setLoading(true);
    try {
      const payload = {
        type, category, description, amount: Number(amount),
        due_date: date,
        competencia: `${competencia}-01`,
        receipt_url: receiptUrl || null,
      };
      if (isEdit) {
        await api.patch(`/financial/${initial.id}`, payload);
      } else {
        await api.post('/financial', payload);
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
        <h2 className={styles.modalTitle}>{isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['income', 'expense'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setType(t)}
                  className={styles.filterBtn} style={{ flex: 1, borderRadius: 10 }}>
                  {type === t ? '● ' : '○ '}{t === 'income' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Competência</label>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Data de vencimento</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Valor (R$) *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className={styles.field}>
            <label>Descrição *</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Conta de água — junho" />
          </div>

          <div className={styles.field}>
            <label>Comprovante / Boleto</label>
            {receiptUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: '1.1rem' }}>📎</span>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {receiptUrl.split('/').pop()?.replace(/^\d+_/, '') ?? 'Anexo'}
                </a>
                <button type="button" onClick={() => setReceiptUrl('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                  title="Remover anexo">✕</button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span>{uploading ? '⏳ Enviando…' : '📎 Clique para anexar PDF ou imagem'}</span>
                <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleFileChange} />
              </label>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Close Month Modal ─────────────────────────────────────────────

function CloseMonthModal({ competencia, onClose, onClosed }: {
  competencia: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/financial/closings', { competencia, notes: notes.trim() || undefined });
      onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar mês');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Fechar {monthLabel(competencia)}</h2>
        <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Após o fechamento, os lançamentos deste mês ficam bloqueados para edição e exclusão.
          O fechamento pode ser reaberto se necessário.
        </p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Observações (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Mês aprovado em assembleia" />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Fechando…' : 'Confirmar fechamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Generate Charges Modal ────────────────────────────────────────

type BillingTarget = 'unit' | 'resident';
type SplitMode = 'equal' | 'responsible';
type RateioMethodParam = 'igualitario' | 'fracaoIdeal' | 'consumoIndividual' | 'misto';

interface GenerateChargesModalProps {
  competencia: string;
  rateioLines: { unit: Unit; amount: number }[];
  rateioMethod: RateioMethodParam;
  mistoMethods: Record<string, 'igualitario' | 'fracaoIdeal'>;
  consumoIndividual: Record<string, string>;
  onClose: () => void;
  onGenerated: () => void;
}

function GenerateChargesModal({
  competencia, rateioLines, rateioMethod, mistoMethods, consumoIndividual, onClose, onGenerated,
}: GenerateChargesModalProps) {
  const [billingTarget, setBillingTarget] = useState<BillingTarget>('unit');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [dueDate, setDueDate] = useState(() => {
    const [y, m] = competencia.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return `${ny}-${String(nm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [description, setDescription] = useState(
    `Rateio condominial — ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`,
  );
  const [forceCancel, setForceCancel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Preview: count how many charges will be generated
  const previewCount = (() => {
    if (billingTarget === 'unit') return rateioLines.filter(l => l.amount > 0).length;
    // Contar moradores únicos (um morador com múltiplas unidades = 1 cobrança)
    const uniqueProfiles = new Set<string>();
    let fallbacks = 0;
    for (const { unit, amount } of rateioLines) {
      if (amount <= 0) continue;
      const profiles = unit.unit_profiles ?? [];
      if (splitMode === 'responsible') {
        const resp = profiles.find(p => p.is_responsible);
        if (resp) uniqueProfiles.add(resp.profile_id);
      } else {
        if (profiles.length === 0) { fallbacks++; }
        else { profiles.forEach(p => uniqueProfiles.add(p.profile_id)); }
      }
    }
    return uniqueProfiles.size + fallbacks;
  })();

  const previewTotal = rateioLines.reduce((s, l) => s + l.amount, 0);

  // Units missing a responsible resident (for warning)
  const missingResponsible = billingTarget === 'resident' && splitMode === 'responsible'
    ? rateioLines.filter(l => l.amount > 0 && !(l.unit.unit_profiles ?? []).some(p => p.is_responsible))
    : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        competencia,
        method: rateioMethod,
        billing_target: billingTarget,
        split_mode: billingTarget === 'resident' ? splitMode : undefined,
        due_date: dueDate,
        description,
        force_cancel: forceCancel || undefined,
        mistoMethods: rateioMethod === 'misto' ? mistoMethods : undefined,
        consumoIndividual: rateioMethod === 'consumoIndividual'
          ? Object.fromEntries(Object.entries(consumoIndividual).map(([k, v]) => [k, parseFloat(v) || 0]))
          : undefined,
      };
      const res = await api.post<ApiResponse<{ created: number; errors: string[] }>>(
        '/financial/rateio/generate-charges', payload,
      );
      const { errors: errs } = res.data;
      if (errs?.length) {
        alert(`Cobranças geradas com avisos:\n${errs.join('\n')}`);
      }
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar cobranças');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Gerar cobranças — {monthLabel(competencia)}</h2>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Tipo de cobrança */}
          <div className={styles.field}>
            <label>Cobrar por</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['unit', 'Unidade'], ['resident', 'Morador']] as [BillingTarget, string][]).map(([v, l]) => (
                <button key={v} type="button"
                  className={styles.filterBtn}
                  style={{ flex: 1, borderRadius: 10, fontWeight: billingTarget === v ? 700 : 400 }}
                  onClick={() => setBillingTarget(v)}>
                  {billingTarget === v ? '● ' : '○ '}{l}
                </button>
              ))}
            </div>
          </div>

          {/* Split mode — só quando "por morador" */}
          {billingTarget === 'resident' && (
            <div className={styles.field}>
              <label>Distribuição entre moradores</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['equal', 'Dividir igualmente'], ['responsible', 'Apenas responsável']] as [SplitMode, string][]).map(([v, l]) => (
                  <button key={v} type="button"
                    className={styles.filterBtn}
                    style={{ flex: 1, borderRadius: 10, fontWeight: splitMode === v ? 700 : 400 }}
                    onClick={() => setSplitMode(v)}>
                    {splitMode === v ? '● ' : '○ '}{l}
                  </button>
                ))}
              </div>
              {splitMode === 'responsible' && missingResponsible.length > 0 && (
                <p style={{ color: '#c0334d', fontSize: '0.82rem', marginTop: 6 }}>
                  ⚠️ Unidades sem responsável definido (serão ignoradas):{' '}
                  {missingResponsible.map(l => `Unidade ${l.unit.number}`).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Vencimento */}
          <div className={styles.field}>
            <label>Data de vencimento *</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
          </div>

          {/* Descrição */}
          <div className={styles.field}>
            <label>Descrição</label>
            <input value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Cancelar existentes automaticamente */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={forceCancel}
              onChange={e => setForceCancel(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span>
              Cancelar automaticamente cobranças pendentes/em atraso existentes desta competência antes de gerar novas
              {forceCancel && (
                <span style={{ display: 'block', color: '#c0334d', fontSize: '0.8rem', marginTop: 2 }}>
                  ⚠️ Cobranças já pagas não serão afetadas.
                </span>
              )}
            </span>
          </label>

          {/* Preview */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 16px', fontSize: '0.88rem',
          }}>
            <strong>{previewCount}</strong> cobranças serão criadas · Total:{' '}
            <strong style={{ color: '#c0334d' }}>{fmt(previewTotal)}</strong>
          </div>

          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading || previewCount === 0}>
              {loading ? 'Gerando…' : 'Confirmar e gerar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
];

export default function Financial() {
  const { profile } = useAuth();
  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [filter, setFilter] = useState('');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; record?: FinancialRecord }>({ open: false });
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [tab, setTab] = useState<'records' | 'closings' | 'rateio'>('records');
  const [generating, setGenerating] = useState(false);
  const [recurringList, setRecurringList] = useState<Recurring[]>([]);

  const [condoName, setCondoName] = useState('');

  // Rateio
  const [units, setUnits] = useState<Unit[]>([]);
  const [rateioMethod, setRateioMethod] = useState<RateioMethod>('igualitario');
  const [consumoIndividual, setConsumoIndividual] = useState<Record<string, string>>({});
  const [mistoMethods, setMistoMethods] = useState<Record<string, 'igualitario' | 'fracaoIdeal'>>({});
  const [showGenerateChargesModal, setShowGenerateChargesModal] = useState(false);

  const isCurrentMonthClosed = closings.some(c => c.competencia.startsWith(selectedMonth));
  const activeRecurring = recurringList.filter(r => r.active);
  const pendingRecurring = activeRecurring.filter(r => {
    const start = `${selectedMonth}-01`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const end = `${ny}-${String(nm).padStart(2, '0')}-01`;
    return !r.last_generated || r.last_generated < start || r.last_generated >= end;
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ competencia: selectedMonth });
      if (filter) params.set('type', filter);
      const [recRes, sumRes, closRes, recurRes, unitsRes, condoRes] = await Promise.all([
        api.get<ApiResponse<FinancialRecord[]>>(`/financial?${params}`),
        api.get<ApiResponse<Summary>>(`/financial/summary?competencia=${selectedMonth}`),
        api.get<ApiResponse<Closing[]>>('/financial/closings'),
        api.get<ApiResponse<Recurring[]>>('/financial/recurring'),
        api.get<ApiResponse<Unit[]>>('/condominium/units'),
        api.get<ApiResponse<{ name: string }>>('/condominium'),
      ]);
      setRecords(recRes.data ?? []);
      setSummary(sumRes.data);
      setClosings(closRes.data ?? []);
      setRecurringList(recurRes.data ?? []);
      setUnits(unitsRes.data ?? []);
      if (condoRes.data?.name) setCondoName(condoRes.data.name);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedMonth, filter]);

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await api.delete(`/financial/${id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  async function handleDuplicate(r: FinancialRecord) {
    await api.post('/financial', {
      type: r.type, category: r.category, description: `${r.description} (cópia)`,
      amount: r.amount,
      due_date: r.due_date ?? r.created_at.slice(0, 10),
      competencia: r.competencia ?? `${selectedMonth}-01`,
    });
    load();
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await api.post<ApiResponse<{ generated: number; skipped: number }>>('/financial/recurring/generate', { competencia: selectedMonth });
      const { generated, skipped } = res.data;
      await load();
      if (generated === 0 && skipped > 0) {
        alert(`As ${skipped} despesa(s) fixa(s) deste mês já haviam sido geradas anteriormente.`);
      } else if (generated > 0) {
        // success — list already reloaded
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar despesas fixas');
    } finally {
      setGenerating(false);
    }
  }

  async function handleReopen(competencia: string) {
    if (!confirm('Reabrir este mês? Os lançamentos poderão ser editados novamente.')) return;
    try {
      await api.delete(`/financial/closings/${competencia.slice(0, 7)}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao reabrir');
    }
  }

  const canEdit = isSindico && !isCurrentMonthClosed;

  // ── Rateio computations ───────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    records.filter(r => r.type === 'expense').forEach(r => {
      map[r.category ?? 'Outros'] = (map[r.category ?? 'Outros'] ?? 0) + r.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const rateioLines = useMemo((): { unit: Unit; amount: number; participacao?: number }[] => {
    const totalExpense = summary?.total_expense ?? 0;
    if (units.length === 0) return [] as { unit: Unit; amount: number; participacao?: number }[];
    const totalSize = units.reduce((s, u) => s + (u.size_sqm ?? 0), 0);

    if (rateioMethod === 'igualitario') {
      const perUnit = totalExpense / units.length;
      return units.map(u => ({ unit: u, amount: perUnit }));
    }

    if (rateioMethod === 'fracaoIdeal') {
      return units.map(u => {
        const frac = totalSize > 0 ? (u.size_sqm ?? 0) / totalSize : 1 / units.length;
        return { unit: u, amount: frac * totalExpense, participacao: frac * 100 };
      });
    }

    if (rateioMethod === 'consumoIndividual') {
      const totalConsumo = Object.values(consumoIndividual).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      const base = Math.max(0, totalExpense - totalConsumo) / units.length;
      return units.map(u => ({
        unit: u,
        amount: base + (parseFloat(consumoIndividual[u.id] ?? '0') || 0),
      }));
    }

    if (rateioMethod === 'misto') {
      return units.map(u => {
        const frac = totalSize > 0 ? (u.size_sqm ?? 0) / totalSize : 1 / units.length;
        let total = 0;
        for (const [cat, amount] of expensesByCategory) {
          const m = mistoMethods[cat] ?? 'igualitario';
          total += m === 'fracaoIdeal' ? frac * amount : amount / units.length;
        }
        return { unit: u, amount: total, participacao: frac * 100 };
      });
    }

    return [] as { unit: Unit; amount: number; participacao?: number }[];
  }, [rateioMethod, units, summary, consumoIndividual, mistoMethods, expensesByCategory]);

  const rateioColSpan = rateioMethod === 'igualitario' ? 3
    : rateioMethod === 'consumoIndividual' ? 4 : 5;

  function handleExportRateio() {
    const rows = [['Unidade', 'Bloco', 'Morador', 'Área (m²)', 'Participação (%)', 'Consumo (R$)', 'Valor Rateio (R$)']];
    
    rateioLines.forEach(({ unit, amount, participacao }) => {
      const morador = (unit.unit_profiles || []).map(up => up.profiles?.name).filter(Boolean).join(', ') || '—';
      const area = unit.size_sqm ? unit.size_sqm.toString() : '—';
      const part = participacao != null ? participacao.toFixed(2) : '—';
      const consumo = rateioMethod === 'consumoIndividual' ? (consumoIndividual[unit.id] || '0') : '—';
      const valor = amount.toFixed(2);
      
      rows.push([
        unit.number,
        unit.blocks?.name ?? '—',
        `"${morador}"`,
        area,
        part,
        consumo,
        valor
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rateio_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      {modal.open && (
        <RecordModal
          initial={modal.record}
          defaultCompetencia={selectedMonth}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
        />
      )}
      {showCloseModal && (
        <CloseMonthModal
          competencia={selectedMonth}
          onClose={() => setShowCloseModal(false)}
          onClosed={() => { setShowCloseModal(false); load(); }}
        />
      )}
      {showGenerateChargesModal && (
        <GenerateChargesModal
          competencia={selectedMonth}
          rateioLines={rateioLines}
          rateioMethod={rateioMethod}
          mistoMethods={mistoMethods}
          consumoIndividual={consumoIndividual}
          onClose={() => setShowGenerateChargesModal(false)}
          onGenerated={() => { setShowGenerateChargesModal(false); alert('Cobranças geradas com sucesso!'); }}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Financeiro</h1>
          <p className={styles.subtitle}>Controle receitas e despesas do condomínio.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isSindico && !isCurrentMonthClosed && (
            <button className={styles.btnSecondary} onClick={() => setShowCloseModal(true)}>
              🔒 Fechar mês
            </button>
          )}
          {canEdit && (
            <button className={styles.btnPrimary} onClick={() => setModal({ open: true })}>+ Lançamento</button>
          )}
        </div>
      </div>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className={styles.iconBtn} style={{ fontSize: '1.2rem' }} onClick={() => setSelectedMonth(m => addMonths(m, -1))}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: 160, textAlign: 'center' }}>
          {monthLabel(selectedMonth)}
          {isCurrentMonthClosed && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
              🔒 Fechado
            </span>
          )}
        </span>
        <button className={styles.iconBtn} style={{ fontSize: '1.2rem' }} onClick={() => setSelectedMonth(m => addMonths(m, 1))}>›</button>
        {selectedMonth !== currentYM() && (
          <button className={styles.filterBtn} style={{ marginLeft: 4 }} onClick={() => setSelectedMonth(currentYM())}>Mês atual</button>
        )}
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Saldo anterior</span>
          <span className={`${styles.summaryValue} ${summary && summary.saldo_anterior >= 0 ? styles.summaryAccent : styles.summaryRed}`}>
            {summary ? fmt(summary.saldo_anterior) : '—'}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Receitas</span>
          <span className={`${styles.summaryValue} ${styles.summaryAccent}`}>{summary ? fmt(summary.total_income) : '—'}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Despesas</span>
          <span className={`${styles.summaryValue} ${styles.summaryRed}`}>{summary ? fmt(summary.total_expense) : '—'}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Saldo final</span>
          <span className={`${styles.summaryValue} ${summary && summary.balance >= 0 ? styles.summaryAccent : styles.summaryRed}`}>
            {summary ? fmt(summary.balance) : '—'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.filters}>
        <button className={`${styles.filterBtn} ${tab === 'records' ? styles.filterActive : ''}`} onClick={() => setTab('records')}>
          Lançamentos
        </button>
        <button className={`${styles.filterBtn} ${tab === 'closings' ? styles.filterActive : ''}`} onClick={() => setTab('closings')}>
          Fechamentos ({closings.length})
        </button>
        <button className={`${styles.filterBtn} ${tab === 'rateio' ? styles.filterActive : ''}`} onClick={() => setTab('rateio')}>
          Rateio
        </button>
      </div>

      {/* Records tab */}
      {tab === 'records' && (
        <>
          <div className={styles.filters}>
            {FILTERS.map(f => (
              <button key={f.value}
                className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ''}`}
                onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {isSindico && !isCurrentMonthClosed && activeRecurring.length === 0 && (
            <div style={{ padding: '10px 16px', background: '#fafafa', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              📅 Nenhuma despesa fixa configurada. Acesse <strong>Configurações → Categorias Financeiras</strong> para configurar.
            </div>
          )}

          {isSindico && !isCurrentMonthClosed && pendingRecurring.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: '0.85rem', color: '#14532d' }}>
              <span>🔄</span>
              <span><strong>{pendingRecurring.length}</strong> despesa(s) fixa(s) ainda não gerada(s) neste mês.</span>
              <button
                className={styles.btnSecondary}
                style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Gerando…' : `Gerar agora`}
              </button>
            </div>
          )}

          {isSindico && !isCurrentMonthClosed && activeRecurring.length > 0 && pendingRecurring.length === 0 && (
            <div style={{ padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: '0.85rem', color: '#14532d' }}>
              ✅ Todas as {activeRecurring.length} despesa(s) fixa(s) já foram geradas neste mês.
            </div>
          )}

          {isCurrentMonthClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, marginBottom: 12, fontSize: '0.85rem', color: '#713f12' }}>
              <span>🔒</span>
              <span>Este mês está <strong>fechado</strong> — lançamentos bloqueados para edição.</span>
              {isSindico && (
                <button className={styles.btnSecondary} style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '4px 12px' }}
                  onClick={() => handleReopen(closings.find(c => c.competencia.startsWith(selectedMonth))?.competencia ?? '')}>
                  Reabrir
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className={styles.skeleton}>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
            </div>
          ) : records.length === 0 ? (
            <div className={styles.empty}><span>💰</span><p>Nenhum lançamento em {monthLabel(selectedMonth)}.</p></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.description}</td>
                      <td className={styles.tdMono}>{r.category}</td>
                      <td>
                        <span className={styles.badge} style={{ background: r.type === 'income' ? '#16a86920' : '#ff000015', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                          {r.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                        {r.type === 'expense' ? '− ' : '+ '}{fmt(r.amount)}
                      </td>
                      <td className={styles.tdMuted}>{(r.due_date ?? r.created_at.slice(0, 10)).split('-').reverse().join('/')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.receipt_url && (
                          <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className={styles.iconBtn} title="Ver comprovante">📎</a>
                        )}
                        {canEdit && (
                          <>
                            <button className={styles.iconBtn} title="Editar" onClick={() => setModal({ open: true, record: r })}>✏️</button>
                            <button className={styles.iconBtn} title="Duplicar" onClick={() => handleDuplicate(r)}>📋</button>
                            <button className={styles.iconBtn} title="Excluir" onClick={() => handleDelete(r.id)}>🗑️</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Rateio tab */}
      {tab === 'rateio' && (
        <div>
          {/* Method selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {([
                ['igualitario', 'Igualitário'],
                ['fracaoIdeal', 'Fração Ideal'],
                ['consumoIndividual', 'Consumo Individual'],
                ['misto', 'Misto'],
              ] as [RateioMethod, string][]).map(([v, l]) => (
                <button key={v}
                  className={`${styles.filterBtn} ${rateioMethod === v ? styles.filterActive : ''}`}
                  onClick={() => setRateioMethod(v)}>
                  {l}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0 }}>
              {RATEIO_DESCRIPTIONS[rateioMethod]}
            </p>
          </div>

          {/* Misto: method per category */}
          {rateioMethod === 'misto' && expensesByCategory.length > 0 && (
            <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.88rem' }}>
                Método por Categoria de Despesa
              </div>
              <table className={styles.table} style={{ marginBottom: 0 }}>
                <thead>
                  <tr><th>Categoria</th><th>Total</th><th>Método</th></tr>
                </thead>
                <tbody>
                  {expensesByCategory.map(([cat, amount]) => (
                    <tr key={cat}>
                      <td style={{ fontWeight: 600 }}>{cat}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: '#c0334d' }}>− {fmt(amount)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 16 }}>
                          {(['igualitario', 'fracaoIdeal'] as const).map(m => (
                            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem' }}>
                              <input type="radio" name={`misto-${cat}`} value={m}
                                checked={(mistoMethods[cat] ?? 'igualitario') === m}
                                onChange={() => setMistoMethods(prev => ({ ...prev, [cat]: m }))} />
                              {m === 'igualitario' ? 'Igualitário' : 'Fração Ideal'}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Total a ratear: <strong style={{ color: '#c0334d' }}>{fmt(summary?.total_expense ?? 0)}</strong>
              &nbsp;·&nbsp; {units.length} unidades
              {rateioMethod === 'fracaoIdeal' || rateioMethod === 'misto'
                ? ` · ${units.reduce((s, u) => s + (u.size_sqm ?? 0), 0)} m² total`
                : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className={styles.btnSecondary} style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={handleExportRateio}>
                📥 Exportar CSV
              </button>
              {rateioLines.length > 0 && summary && (
                <button
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  onClick={() => printRateioReport({
                    condoName,
                    competencia: selectedMonth,
                    summary: {
                      saldo_anterior: summary.saldo_anterior,
                      total_income: summary.total_income,
                      total_expense: summary.total_expense,
                      balance: summary.balance,
                    },
                    expensesByCategory,
                    rateioLines: rateioLines.map(({ unit, amount, participacao }) => ({
                      unit: {
                        number: unit.number,
                        blocks: unit.blocks,
                        unit_profiles: (unit.unit_profiles ?? []).map(up => ({ profiles: { name: up.profiles?.name } })),
                      },
                      amount,
                      participacao,
                    })),
                    rateioMethod,
                  })}
                >
                  📄 Relatório
                </button>
              )}
              {isSindico && (
                <button
                  className={styles.btnPrimary}
                  style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  disabled={!isCurrentMonthClosed || rateioLines.length === 0}
                  title={!isCurrentMonthClosed ? 'Feche o mês para gerar cobranças' : ''}
                  onClick={() => setShowGenerateChargesModal(true)}
                >
                  💳 Gerar cobrança
                </button>
              )}
            </div>
          </div>

          {/* Units table */}
          {units.length === 0 ? (
            <div className={styles.empty}><span>🏢</span><p>Nenhuma unidade cadastrada. Acesse Configurações para cadastrar.</p></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Bloco</th>
                    <th>Morador</th>
                    {(rateioMethod === 'fracaoIdeal' || rateioMethod === 'misto') && <th>Área (m²)</th>}
                    {(rateioMethod === 'fracaoIdeal' || rateioMethod === 'misto') && <th>Participação</th>}
                    {rateioMethod === 'consumoIndividual' && <th>Consumo (R$)</th>}
                    <th style={{ textAlign: 'right' }}>Valor do Rateio</th>
                  </tr>
                </thead>
                <tbody>
                  {rateioLines.map(({ unit, amount, participacao }) => (
                    <tr key={unit.id}>
                      <td style={{ fontWeight: 600 }}>Unidade {unit.number}</td>
                      <td className={styles.tdMuted}>{unit.blocks?.name ?? '—'}</td>
                      <td className={styles.tdMuted}>{(unit.unit_profiles || []).map(up => up.profiles?.name).filter(Boolean).join(', ') || '—'}</td>
                      {(rateioMethod === 'fracaoIdeal' || rateioMethod === 'misto') && (
                        <td className={styles.tdMuted}>{unit.size_sqm ? `${unit.size_sqm} m²` : '—'}</td>
                      )}
                      {(rateioMethod === 'fracaoIdeal' || rateioMethod === 'misto') && (
                        <td className={styles.tdMuted}>{participacao != null ? `${participacao.toFixed(2)}%` : '—'}</td>
                      )}
                      {rateioMethod === 'consumoIndividual' && (
                        <td>
                          <input type="number" min="0" step="0.01"
                            style={{ width: 110, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: '0.88rem' }}
                            value={consumoIndividual[unit.id] ?? ''}
                            onChange={e => setConsumoIndividual(prev => ({ ...prev, [unit.id]: e.target.value }))}
                            placeholder="0,00" />
                        </td>
                      )}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                    <td colSpan={rateioColSpan} style={{ fontWeight: 700, textAlign: 'right', padding: '10px 12px' }}>Total:</td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: '#c0334d', textAlign: 'right', padding: '10px 12px' }}>
                      {fmt(rateioLines.reduce((s, l) => s + l.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Closings tab */}
      {tab === 'closings' && (
        closings.length === 0 ? (
          <div className={styles.empty}><span>📋</span><p>Nenhum mês fechado ainda.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Saldo inicial</th>
                  <th>Receitas</th>
                  <th>Despesas</th>
                  <th>Saldo final</th>
                  <th>Fechado em</th>
                  {isSindico && <th></th>}
                </tr>
              </thead>
              <tbody>
                {closings.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(c.competencia.slice(0, 7))}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: c.saldo_inicial >= 0 ? 'var(--green-dark)' : '#c0334d' }}>{fmt(c.saldo_inicial)}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--green-dark)' }}>+ {fmt(c.total_income)}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: '#c0334d' }}>− {fmt(c.total_expense)}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: c.saldo_final >= 0 ? 'var(--green-dark)' : '#c0334d' }}>{fmt(c.saldo_final)}</td>
                    <td className={styles.tdMuted}>{new Date(c.closed_at).toLocaleDateString('pt-BR')}</td>
                    {isSindico && (
                      <td>
                        <button className={styles.iconBtn} title="Reabrir mês" onClick={() => handleReopen(c.competencia.slice(0, 7))}>🔓</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
