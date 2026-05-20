import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';
import {
  printFinancialReport,
  printChargesReport,
  printAttachmentsReport,
  printFullReport,
} from '../utils/reports';

interface ApiResponse<T> { data: T }

interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  due_date?: string;
  competencia?: string;
  receipt_url?: string;
}

interface Charge {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at?: string;
  competencia?: string;
  units?: { number: string; blocks?: { name: string } };
  profiles?: {
    name: string;
    unit_profiles?: { units?: { number: string; blocks?: { name: string } } | null }[];
  } | null;
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function unitLabelFromCharge(c: Charge): string {
  const allUnits = c.profiles?.unit_profiles?.length
    ? c.profiles.unit_profiles
        .map(up => up.units)
        .filter(Boolean)
        .map(u => `${u!.blocks?.name ? `${u!.blocks.name} · ` : ''}${u!.number}`)
    : c.units
      ? [`${c.units.blocks?.name ? `${c.units.blocks.name} · ` : ''}${c.units.number}`]
      : [];
  return allUnits.join(', ') || '—';
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', overdue: 'Em atraso', cancelled: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', paid: '#16A869', overdue: '#E5257A', cancelled: '#9CA3AF',
};

async function fetchBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mimeType = blob.type || 'application/octet-stream';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ base64: result.split(',')[1], mimeType });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function Reports() {
  const [competencia, setCompetencia] = useState(currentYM());
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [condoName, setCondoName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingFiles, setFetchingFiles] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<{ name: string }>>('/condominium')
      .then(r => { if (r.data?.name) setCondoName(r.data.name); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<ApiResponse<FinancialRecord[]>>(`/financial?competencia=${competencia}`),
      api.get<ApiResponse<Charge[]>>(`/charges?competencia=${competencia}`),
    ]).then(([recRes, chgRes]) => {
      setRecords(recRes.data ?? []);
      setCharges(chgRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [competencia]);

  const totalIncome  = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const attachments  = records.filter(r => r.receipt_url);

  function handlePrintFinancial() {
    printFinancialReport({
      condoName,
      competencia,
      records: records.map(r => ({
        description: r.description,
        category: r.category,
        type: r.type,
        amount: r.amount,
        due_date: r.due_date,
        receipt_url: r.receipt_url,
      })),
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    });
  }

  function handlePrintCharges() {
    printChargesReport({
      condoName,
      competencia,
      charges: charges.map(c => ({
        description: c.description,
        unitLabel: unitLabelFromCharge(c),
        residentName: c.profiles?.name ?? '—',
        amount: c.amount,
        due_date: c.due_date,
        status: c.status,
        paid_at: c.paid_at,
        competencia: c.competencia,
      })),
    });
  }

  async function handlePrintAttachments() {
    setFetchingFiles(true);
    const withData = await Promise.all(
      attachments.map(async r => {
        const fileData = await fetchBase64(r.receipt_url!);
        return {
          description: r.description,
          category: r.category,
          type: r.type,
          amount: r.amount,
          due_date: r.due_date,
          receipt_url: r.receipt_url!,
          fileData,
        };
      })
    );
    setFetchingFiles(false);
    printAttachmentsReport({ condoName, competencia, records: withData });
  }

  async function handlePrintFull() {
    setFetchingFiles(true);
    const attWithData = await Promise.all(
      attachments.map(async r => {
        const fileData = await fetchBase64(r.receipt_url!);
        return {
          description: r.description,
          category: r.category,
          type: r.type,
          amount: r.amount,
          due_date: r.due_date,
          receipt_url: r.receipt_url!,
          fileData,
        };
      })
    );
    setFetchingFiles(false);
    printFullReport({
      financial: {
        condoName,
        competencia,
        records: records.map(r => ({
          description: r.description,
          category: r.category,
          type: r.type,
          amount: r.amount,
          due_date: r.due_date,
          receipt_url: r.receipt_url,
        })),
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
      },
      charges: {
        condoName,
        competencia,
        charges: charges.map(c => ({
          description: c.description,
          unitLabel: unitLabelFromCharge(c),
          residentName: c.profiles?.name ?? '—',
          amount: c.amount,
          due_date: c.due_date,
          status: c.status,
          paid_at: c.paid_at,
          competencia: c.competencia,
        })),
      },
      attachments: {
        condoName,
        competencia,
        records: attWithData,
      },
    });
  }

  return (
    <div className={styles.page}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Relatórios</h1>
          <p className={styles.subtitle}>Gere relatórios em PDF por competência mensal.</p>
        </div>
      </div>

      {/* Seletor de competência */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className={styles.iconBtn} style={{ fontSize: '1.2rem' }} onClick={() => setCompetencia(m => addMonths(m, -1))}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 180, textAlign: 'center' }}>
          {monthLabel(competencia)}
        </span>
        <button className={styles.iconBtn} style={{ fontSize: '1.2rem' }} onClick={() => setCompetencia(m => addMonths(m, 1))}>›</button>
        {competencia !== currentYM() && (
          <button className={styles.filterBtn} onClick={() => setCompetencia(currentYM())}>Mês atual</button>
        )}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeletonRow} style={{ height: 120 }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Relatório 1: Lançamentos Financeiros ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>💰 Lançamentos Financeiros</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {records.length} lançamento(s) · Receitas {fmt(totalIncome)} · Despesas {fmt(totalExpense)}
                </div>
              </div>
              <button
                className={styles.btnPrimary}
                style={{ fontSize: '0.85rem' }}
                disabled={records.length === 0}
                onClick={handlePrintFinancial}
              >
                📄 Gerar PDF
              </button>
            </div>
            {records.length === 0 ? (
              <div className={styles.empty} style={{ padding: '20px 0' }}>
                <span>💰</span><p>Nenhum lançamento em {monthLabel(competencia)}.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th style={{ textAlign: 'right' }}>Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.description || '—'}</td>
                        <td className={styles.tdMuted}>{r.category}</td>
                        <td>
                          <span className={styles.badge} style={{ background: r.type === 'income' ? '#16a86920' : '#ff000015', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                            {r.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                          {r.type === 'expense' ? '− ' : '+ '}{fmt(r.amount)}
                        </td>
                        <td className={styles.tdMuted} style={{ textAlign: 'right' }}>
                          {r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Relatório 2: Cobranças ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>📄 Cobranças</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {charges.length} cobrança(s) · Total{' '}
                  {fmt(charges.reduce((s, c) => s + c.amount, 0))}
                </div>
              </div>
              <button
                className={styles.btnPrimary}
                style={{ fontSize: '0.85rem' }}
                disabled={charges.length === 0}
                onClick={handlePrintCharges}
              >
                📄 Gerar PDF
              </button>
            </div>
            {charges.length === 0 ? (
              <div className={styles.empty} style={{ padding: '20px 0' }}>
                <span>📄</span><p>Nenhuma cobrança em {monthLabel(competencia)}.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Morador</th>
                      <th>Descrição</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th style={{ textAlign: 'right' }}>Vencimento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{unitLabelFromCharge(c)}</td>
                        <td className={styles.tdMuted}>{c.profiles?.name ?? '—'}</td>
                        <td>{c.description}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(c.amount)}</td>
                        <td className={styles.tdMuted} style={{ textAlign: 'right' }}>
                          {new Date(c.due_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td>
                          <span className={styles.badge} style={{ background: `${STATUS_COLOR[c.status]}20`, color: STATUS_COLOR[c.status] }}>
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Relatório 3: Anexos ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>📎 Anexos — Comprovantes e Boletos</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {attachments.length} lançamento(s) com comprovante anexado
                </div>
              </div>
              <button
                className={styles.btnPrimary}
                style={{ fontSize: '0.85rem' }}
                disabled={attachments.length === 0 || fetchingFiles}
                onClick={handlePrintAttachments}
              >
                {fetchingFiles ? '⏳ Carregando arquivos…' : '📄 Gerar PDF'}
              </button>
            </div>
            {attachments.length === 0 ? (
              <div className={styles.empty} style={{ padding: '20px 0' }}>
                <span>📎</span><p>Nenhum lançamento com comprovante em {monthLabel(competencia)}.</p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th style={{ textAlign: 'right' }}>Vencimento</th>
                      <th>Comprovante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachments.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.description || '—'}</td>
                        <td className={styles.tdMuted}>{r.category}</td>
                        <td>
                          <span className={styles.badge} style={{ background: r.type === 'income' ? '#16a86920' : '#ff000015', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                            {r.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--mono)', color: r.type === 'income' ? 'var(--green-dark)' : '#c0334d' }}>
                          {fmt(r.amount)}
                        </td>
                        <td className={styles.tdMuted} style={{ textAlign: 'right' }}>
                          {r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td>
                          <a href={r.receipt_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.82rem', color: 'var(--accent)', textDecoration: 'none' }}>
                            📎 {r.receipt_url!.split('/').pop()?.replace(/^\d+_/, '') ?? 'Ver'}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Relatório 4: Consolidado ── */}
          <div style={{ border: '2px solid var(--accent)', borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #f0fdf4 0%, #f8faff 100%)' }}>
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>📋 Relatório Consolidado</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Gera um único PDF com Lançamentos + Cobranças + Anexos de {monthLabel(competencia)},
                  incluindo resumo geral e área de assinatura.
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>💰 {records.length} lançamento(s)</span>
                  <span>·</span>
                  <span>📄 {charges.length} cobrança(s)</span>
                  <span>·</span>
                  <span>📎 {attachments.length} anexo(s)</span>
                </div>
              </div>
              <button
                className={styles.btnPrimary}
                style={{ fontSize: '0.9rem', padding: '10px 20px', whiteSpace: 'nowrap' }}
                disabled={(records.length === 0 && charges.length === 0) || fetchingFiles}
                onClick={handlePrintFull}
              >
                {fetchingFiles ? '⏳ Carregando arquivos…' : '📋 Gerar PDF Completo'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
