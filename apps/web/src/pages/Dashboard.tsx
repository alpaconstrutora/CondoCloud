import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import styles from './Dashboard.module.css';

interface DashboardSummary {
  tickets_open: number;
  tickets_in_progress: number;
  tickets_resolved: number;
  active_residents: number;
  charges_pending: number;
  charges_overdue: number;
  total_messages: number;
}

interface ApiResponse<T> {
  data: T;
}

interface Ticket {
  id: string;
  title: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: number;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#E5257A',
  in_progress: '#F59E0B',
  resolved: '#16A869',
  closed: '#9ca3af',
};

const PRIORITY_LABEL = ['', 'Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];

function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statAccent} style={{ background: accent }} />
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.get<ApiResponse<DashboardSummary>>('/metrics/dashboard'),
        api.get<ApiResponse<Ticket[]>>('/tickets?status=open'),
      ]);

      const [summaryResult, ticketsResult] = results;

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value.data);
      } else {
        const msg = summaryResult.reason instanceof Error ? summaryResult.reason.message : '';
        if (!msg.includes('<!DOCTYPE') && !msg.includes('403') && !msg.includes('401')) {
          setError(msg);
        }
      }

      if (ticketsResult.status === 'fulfilled') {
        setTickets(ticketsResult.value.data.slice(0, 8));
      }

      setLoading(false);
    }
    load();
  }, []);

  const firstName = (user?.user_metadata?.['full_name'] as string)?.split(' ')[0] ?? 'Síndico';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Olá, {firstName} 👋</h1>
          <p className={styles.subtitle}>Aqui está o resumo do seu condomínio.</p>
        </div>
        <Link to="/tickets" className={styles.btnPrimary}>+ Novo chamado</Link>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error.includes('403') || error.includes('401')
            ? 'Condomínio não configurado. Complete o onboarding para ver os dados.'
            : error.includes('Tempo limite')
              ? 'O servidor está inicializando. Aguarde alguns segundos e recarregue a página.'
              : `Erro ao carregar: ${error}`}
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Chamados abertos"
          value={loading ? '—' : (summary?.tickets_open ?? 0)}
          accent="#E5257A"
          sub={summary ? `${summary.tickets_in_progress} em andamento` : undefined}
        />
        <StatCard
          label="Moradores ativos"
          value={loading ? '—' : (summary?.active_residents ?? 0)}
          accent="#16A869"
        />
        <StatCard
          label="Cobranças pendentes"
          value={loading ? '—' : (summary?.charges_pending ?? 0)}
          accent="#F59E0B"
          sub={summary?.charges_overdue ? `${summary.charges_overdue} em atraso` : undefined}
        />
        <StatCard
          label="Comunicados enviados"
          value={loading ? '—' : (summary?.total_messages ?? 0)}
          accent="#0E4D35"
        />
      </div>

      {/* Recent tickets */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Chamados abertos</h2>
          <Link to="/tickets" className={styles.sectionLink}>Ver todos →</Link>
        </div>

        {loading ? (
          <div className={styles.skeleton}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className={styles.empty}>
            <span>✅</span>
            <p>Nenhum chamado aberto. Tudo em ordem!</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Chamado</th>
                  <th>Categoria</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>Aberto em</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.tdTitle}>
                      <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                    </td>
                    <td className={styles.tdMono}>{t.category}</td>
                    <td>
                      <span
                        className={styles.priority}
                        style={{ color: t.priority >= 4 ? '#E5257A' : t.priority >= 3 ? '#F59E0B' : '#16A869' }}
                      >
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{ background: `${STATUS_COLOR[t.status]}20`, color: STATUS_COLOR[t.status] }}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className={styles.tdMuted}>
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Ações rápidas</h2>
        <div className={styles.actionsGrid}>
          {[
            { to: '/assemblies', icon: '🗳️', label: 'Nova assembleia' },
            { to: '/charges', icon: '📄', label: 'Emitir cobrança' },
            { to: '/reservations', icon: '📅', label: 'Ver reservas' },
            { to: '/documents', icon: '📁', label: 'Enviar documento' },
          ].map((a) => (
            <Link key={a.to} to={a.to} className={styles.actionCard}>
              <span className={styles.actionIcon}>{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
