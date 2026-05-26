import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';

interface Plan {
  id: string;
  name: string;
  price_monthly: number | null;
}

interface Proposal {
  id: string;
  token: string;
  plan_id: string | null;
  converted_at: string | null;
  expires_at: string | null;
  created_at: string;
  plans?: { name: string } | null;
  proposal_interactions?: [{ count: number }];
}

interface ApiResponse<T> {
  data: T;
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProposalLinkBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/proposta/${token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <input
        readOnly
        value={url}
        style={{
          flex: 1, fontSize: '0.78rem', padding: '6px 10px',
          border: '1px solid var(--border)', borderRadius: 8,
          background: '#f9fafb', color: '#555', fontFamily: 'var(--mono)',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      />
      <button
        onClick={copy}
        style={{
          fontSize: '0.78rem', padding: '6px 14px',
          background: copied ? '#16A869' : 'var(--accent,#16A869)',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
        }}
      >
        {copied ? '✓ Copiado' : '📋 Copiar'}
      </button>
    </div>
  );
}

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [creating, setCreating] = useState(false);
  const [convertingId, setConvertingId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [pRes, plRes] = await Promise.all([
        api.get<ApiResponse<Proposal[]>>('/proposals'),
        api.get<ApiResponse<Plan[]>>('/billing/plans'),
      ]);
      setProposals(pRes.data ?? []);
      setPlans(plRes.data ?? []);
      if (plRes.data?.length) setSelectedPlan(plRes.data[0].id);
    } catch {
      setError('Erro ao carregar propostas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    setCreating(true);
    try {
      await api.post('/proposals', { plan_id: selectedPlan });
      setShowForm(false);
      await load();
    } catch {
      alert('Erro ao criar proposta. Tente novamente.');
    } finally {
      setCreating(false);
    }
  }

  async function handleConvert(token: string, proposalId: string) {
    if (!confirm('Marcar esta proposta como convertida (contrato fechado)?')) return;
    setConvertingId(proposalId);
    try {
      await api.patch(`/proposals/${token}/convert`, {});
      await load();
    } catch {
      alert('Erro ao converter proposta.');
    } finally {
      setConvertingId('');
    }
  }

  const interactions = (p: Proposal) =>
    p.proposal_interactions?.[0]?.count ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Propostas</h1>
          <p className={styles.subtitle}>
            Gere links de proposta para apresentar ao conselho ou responsáveis financeiros.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancelar' : '+ Nova proposta'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            border: '1.5px solid var(--accent,#16A869)',
            borderRadius: 14, padding: '20px 24px',
            background: 'linear-gradient(135deg,#f0fdf4,#f8faff)',
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: '1rem' }}>Nova proposta</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className={styles.label}>Plano</label>
              <select
                className={styles.input}
                value={selectedPlan}
                onChange={e => setSelectedPlan(e.target.value)}
                required
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {PLAN_LABEL[p.name] ?? p.name}
                    {p.price_monthly ? ` — ${fmt(p.price_monthly)}/mês` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={creating || !selectedPlan}
              style={{ minWidth: 140 }}
            >
              {creating ? '⏳ Gerando…' : '📄 Gerar proposta'}
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: '0.8rem', color: '#555' }}>
            A proposta captura um snapshot do condomínio (moradores, chamados) e gera um link compartilhável.
          </p>
        </form>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} style={{ height: 90 }} />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className={styles.empty}>
          <span>📄</span>
          <p>Nenhuma proposta gerada ainda.</p>
          <p style={{ fontSize: '0.85rem' }}>
            Gere uma proposta para apresentar ao conselho ou responsáveis financeiros
            e compartilhe o link para aprovação.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {proposals.map(p => {
            const planName = p.plans?.name ?? 'starter';
            const isConverted = !!p.converted_at;
            const isExpired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
            const interCount = interactions(p);

            return (
              <div
                key={p.id}
                style={{
                  border: `1.5px solid ${isConverted ? '#16a86940' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '16px 20px',
                  background: isConverted ? '#f0fdf4' : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        Plano {PLAN_LABEL[planName] ?? planName}
                      </span>
                      {isConverted && (
                        <span style={{
                          background: '#16a86920', color: '#16A869',
                          borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          ✓ Convertida
                        </span>
                      )}
                      {!isConverted && isExpired && (
                        <span style={{
                          background: '#f3f4f6', color: '#9CA3AF',
                          borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          Expirada
                        </span>
                      )}
                      {!isConverted && !isExpired && (
                        <span style={{
                          background: '#eef2ff', color: '#6366f1',
                          borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          Ativa
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      Criada em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      {interCount > 0 && ` · ${interCount} visualização${interCount !== 1 ? 'ões' : ''}`}
                      {p.expires_at && ` · Expira em ${new Date(p.expires_at).toLocaleDateString('pt-BR')}`}
                      {isConverted && p.converted_at && ` · Convertida em ${new Date(p.converted_at).toLocaleDateString('pt-BR')}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isConverted && !isExpired && (
                      <button
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => handleConvert(p.token, p.id)}
                        disabled={convertingId === p.id}
                      >
                        {convertingId === p.id ? '⏳' : '✅ Marcar convertida'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Link compartilhável */}
                {!isExpired && <ProposalLinkBox token={p.token} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
