import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';

interface BillingStatus {
  subscription_status: string;
  plan_name: string;
  plan_price_monthly: number | null;
  trial_ends_at: string | null;
  past_due_since: string | null;
  days_until_blocked: number | null;
  stripe_customer_id: string | null;
  usage: {
    units: number;
    max_units: number;
    residents: number;
    max_residents: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Ativo',         color: '#16A869', bg: '#f0fdf4' },
  trialing: { label: 'Período de teste', color: '#6366f1', bg: '#eef2ff' },
  past_due: { label: 'Pagamento pendente', color: '#F59E0B', bg: '#FEF3C7' },
  canceled: { label: 'Cancelado',     color: '#E5257A', bg: '#fff0f6' },
  paused:   { label: 'Pausado',       color: '#9CA3AF', bg: '#f9fafb' },
};

const PLAN_LABEL: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

const PLANS = [
  {
    name: 'starter',
    label: 'Starter',
    price: 'R$ 129/mês',
    features: ['Até 50 unidades', 'Até 100 moradores', '3 áreas comuns', 'Chamados ilimitados', 'Comunicados ilimitados'],
  },
  {
    name: 'pro',
    label: 'Pro',
    price: 'R$ 249/mês',
    highlight: true,
    features: ['Até 200 unidades', 'Até 400 moradores', 'Áreas comuns ilimitadas', 'Relatórios mensais em PDF', 'Suporte prioritário'],
  },
  {
    name: 'enterprise',
    label: 'Enterprise',
    price: 'Sob consulta',
    features: ['Unidades ilimitadas', 'Multi-condomínio', 'Tudo do Pro', 'SLA garantido', 'Onboarding dedicado'],
  },
];

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max >= 9999 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const isUnlimited = max >= 9999;
  const color = pct >= 90 ? '#E5257A' : pct >= 70 ? '#F59E0B' : '#16A869';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</span>
        <span style={{ fontSize: '0.875rem', color: '#555' }}>
          {used} / {isUnlimited ? '∞' : max}
          {!isUnlimited && <span style={{ color: '#999', marginLeft: 6 }}>({pct}%)</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: color,
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ApiResponse<BillingStatus>>('/billing/status')
      .then(r => setStatus(r.data))
      .catch(() => setError('Não foi possível carregar informações de assinatura.'))
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const r = await api.get<ApiResponse<{ url: string }>>('/billing/portal');
      window.open(r.data.url, '_blank');
    } catch {
      alert('Não foi possível abrir o portal de assinatura. Tente novamente.');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCheckout(planName: string) {
    setCheckoutLoading(planName);
    try {
      const r = await api.post<ApiResponse<{ url: string }>>('/billing/checkout', {
        plan_name: planName,
        success_url: `${window.location.origin}/billing?success=1`,
        cancel_url:  `${window.location.origin}/billing?canceled=1`,
      });
      window.location.href = r.data.url;
    } catch {
      alert('Não foi possível iniciar o checkout. Tente novamente.');
    } finally {
      setCheckoutLoading('');
    }
  }

  const st = status ? (STATUS_LABEL[status.subscription_status] ?? STATUS_LABEL['active']) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Assinatura</h1>
          <p className={styles.subtitle}>Gerencie seu plano, uso e faturamento.</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} style={{ height: 100 }} />
          ))}
        </div>
      ) : error ? (
        <div className={styles.empty}>
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      ) : status && st ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Status atual ── */}
          <div style={{ background: st.bg, border: `1.5px solid ${st.color}40`, borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#111' }}>
                    Plano {PLAN_LABEL[status.plan_name] ?? status.plan_name}
                  </span>
                  <span style={{
                    background: `${st.color}20`,
                    color: st.color,
                    borderRadius: 99,
                    padding: '3px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}>
                    {st.label}
                  </span>
                </div>

                {status.plan_price_monthly && (
                  <div style={{ fontSize: '0.9rem', color: '#555' }}>
                    R$ {status.plan_price_monthly.toLocaleString('pt-BR')}/mês
                  </div>
                )}

                {status.subscription_status === 'trialing' && status.trial_ends_at && (
                  <div style={{ marginTop: 6, fontSize: '0.875rem', color: '#6366f1', fontWeight: 600 }}>
                    ⏳ Trial encerra em{' '}
                    {new Date(status.trial_ends_at).toLocaleDateString('pt-BR')}
                  </div>
                )}

                {status.subscription_status === 'past_due' && status.days_until_blocked !== null && (
                  <div style={{ marginTop: 6, fontSize: '0.875rem', color: '#F59E0B', fontWeight: 700 }}>
                    ⚠️ Acesso bloqueado em {status.days_until_blocked} dia{status.days_until_blocked !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {status.stripe_customer_id && (
                  <button
                    className={styles.btnSecondary}
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? '⏳ Abrindo…' : '💳 Gerenciar faturamento'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Uso do plano ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', background: '#fff' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 20 }}>📊 Uso do plano</h2>
            <UsageBar
              used={status.usage.units}
              max={status.usage.max_units}
              label="Unidades cadastradas"
            />
            <UsageBar
              used={status.usage.residents}
              max={status.usage.max_residents}
              label="Moradores ativos"
            />
          </div>

          {/* ── Planos disponíveis ── */}
          {status.plan_name !== 'enterprise' && (
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>🚀 Faça upgrade</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {PLANS.map(plan => {
                  const isCurrent = plan.name === status.plan_name;
                  const isDowngrade = PLANS.findIndex(p => p.name === status.plan_name) >
                                      PLANS.findIndex(p => p.name === plan.name);
                  return (
                    <div
                      key={plan.name}
                      style={{
                        border: plan.highlight
                          ? '2px solid var(--accent, #16A869)'
                          : '1.5px solid var(--border)',
                        borderRadius: 14,
                        padding: '20px',
                        background: plan.highlight ? 'linear-gradient(135deg,#f0fdf4,#f8faff)' : '#fff',
                        position: 'relative',
                      }}
                    >
                      {plan.highlight && (
                        <div style={{
                          position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                          background: 'var(--accent,#16A869)', color: '#fff',
                          fontSize: '0.72rem', fontWeight: 700, borderRadius: 99,
                          padding: '3px 14px',
                        }}>
                          MAIS POPULAR
                        </div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>{plan.label}</div>
                      <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--accent,#16A869)', marginBottom: 14 }}>
                        {plan.price}
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', fontSize: '0.85rem', color: '#444' }}>
                        {plan.features.map(f => (
                          <li key={f} style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
                            <span style={{ color: 'var(--accent,#16A869)' }}>✓</span> {f}
                          </li>
                        ))}
                      </ul>

                      {isCurrent ? (
                        <div style={{
                          textAlign: 'center', padding: '10px', borderRadius: 10,
                          background: '#e5e7eb', color: '#555', fontWeight: 600, fontSize: '0.875rem',
                        }}>
                          Plano atual
                        </div>
                      ) : plan.name === 'enterprise' ? (
                        <a
                          href="mailto:vendas@condocloud.com.br"
                          style={{
                            display: 'block', textAlign: 'center', padding: '10px',
                            borderRadius: 10, background: '#111', color: '#fff',
                            fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
                          }}
                        >
                          Falar com vendas
                        </a>
                      ) : isDowngrade ? null : (
                        <button
                          className={styles.btnPrimary}
                          style={{ width: '100%', fontSize: '0.875rem' }}
                          disabled={!!checkoutLoading}
                          onClick={() => handleCheckout(plan.name)}
                        >
                          {checkoutLoading === plan.name ? '⏳ Aguarde…' : `Assinar ${plan.label}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
