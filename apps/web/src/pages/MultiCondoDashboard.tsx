import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface CondoSummary {
  id: string;
  name: string;
  tickets_open: number;
  charges_pending: number;
  charges_overdue: number;
  active_residents: number;
  total_messages: number;
}

function NewCondoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/condominium', { name: name.trim(), address: address || undefined, cnpj: cnpj || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar condomínio');
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 420, maxWidth: '95vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827' }}>
          Novo condomínio
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
              Nome *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Condomínio Residencial..."
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
              Endereço
            </label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
              CNPJ
            </label>
            <input
              value={cnpj}
              onChange={e => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? 'Criando…' : 'Criar condomínio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: '#6366f1', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px', background: '#f3f4f6', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

export default function MultiCondoDashboard() {
  const { myCondominiums, switchCondominium, refreshCondominiums } = useAuth();
  const [summaries, setSummaries] = useState<CondoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results: CondoSummary[] = [];

      for (const condo of myCondominiums) {
        try {
          const res = await fetch(`/api/v1/metrics/dashboard`, {
            headers: {
              Authorization: `Bearer ${(await import('../lib/supabase').then(m => m.supabase.auth.getSession())).data.session?.access_token ?? ''}`,
              'X-Active-Condo-ID': condo.id,
              'Content-Type': 'application/json',
            },
          });
          if (res.ok) {
            const json = await res.json() as { data: Record<string, number> };
            results.push({ id: condo.id, name: condo.name, ...json.data } as CondoSummary);
          }
        } catch { /* ignora condomínio com erro */ }
      }

      setSummaries(results);
      setLoading(false);
    }

    if (myCondominiums.length > 0) load();
    else setLoading(false);
  }, [myCondominiums]);

  const totals = summaries.reduce(
    (acc, s) => ({
      tickets_open: acc.tickets_open + (s.tickets_open ?? 0),
      charges_pending: acc.charges_pending + (s.charges_pending ?? 0),
      charges_overdue: acc.charges_overdue + (s.charges_overdue ?? 0),
      active_residents: acc.active_residents + (s.active_residents ?? 0),
    }),
    { tickets_open: 0, charges_pending: 0, charges_overdue: 0, active_residents: 0 },
  );

  async function handleCreated() {
    setShowNew(false);
    await refreshCondominiums?.();
  }

  if (loading) return <div style={{ padding: 32 }}>Carregando dados...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      {showNew && <NewCondoModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Painel Geral</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0' }}>
            {myCondominiums.length} condomínio{myCondominiums.length !== 1 ? 's' : ''} vinculado{myCondominiums.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>
          + Novo condomínio
        </button>
      </div>

      {/* Totalizadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, margin: '28px 0 36px' }}>
        <StatCard label="Chamados abertos" value={totals.tickets_open} color="#f59e0b" />
        <StatCard label="Cobranças pendentes" value={totals.charges_pending} color="#6366f1" />
        <StatCard label="Cobranças vencidas" value={totals.charges_overdue} color="#ef4444" />
        <StatCard label="Moradores ativos" value={totals.active_residents} color="#10b981" />
      </div>

      {/* Cards por condomínio */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#374151' }}>Por Condomínio</h2>
      {summaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <p>Nenhum condomínio cadastrado ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {summaries.map((s) => (
            <div key={s.id} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.active_residents} moradores</div>
                </div>
                <button
                  onClick={() => { switchCondominium(s.id); window.location.href = '/dashboard'; }}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  Acessar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MiniStat label="Chamados" value={s.tickets_open} color="#f59e0b" />
                <MiniStat label="Pendentes" value={s.charges_pending} color="#6366f1" />
                <MiniStat label="Vencidos" value={s.charges_overdue} color="#ef4444" />
                <MiniStat label="Mensagens" value={s.total_messages} color="#10b981" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
    </div>
  );
}
