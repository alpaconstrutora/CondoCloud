import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import CondominiumSwitcher from './CondominiumSwitcher';
import styles from './AppLayout.module.css';

const NAV_ITEMS_BASE = [
  { to: '/dashboard', label: 'Painel', icon: '⊞' },
  { to: '/tickets', label: 'Chamados', icon: '🎫' },
  { to: '/messages', label: 'Comunicados', icon: '💬' },
  { to: '/financial', label: 'Financeiro', icon: '💰' },
  { to: '/charges', label: 'Cobranças', icon: '📄' },
  { to: '/assemblies', label: 'Assembleias', icon: '🗳️' },
  { to: '/reservations', label: 'Reservas', icon: '📅' },
  { to: '/documents', label: 'Documentos', icon: '📁' },
  { to: '/residents', label: 'Moradores', icon: '👥' },
  { to: '/vendors', label: 'Fornecedores', icon: '🔧' },
  { to: '/reports', label: 'Relatórios', icon: '📊' },
  { to: '/whatsapp', label: 'WhatsApp', icon: '💬' },
  { to: '/proposals', label: 'Propostas', icon: '📄' },
  { to: '/billing', label: 'Assinatura', icon: '💳' },
  { to: '/settings', label: 'Configurações', icon: '⚙️' },
];

const NAV_ITEM_OVERVIEW = { to: '/overview', label: 'Visão Geral', icon: '🗺️' };

interface Notification {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await api.get<{ data: { count: number } }>('/notifications/unread-count');
      setCount(res.data.count ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30_000);
    return () => clearInterval(interval);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    api.get<{ data: Notification[] }>('/notifications')
      .then(res => setNotifications(res.data ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {}).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setCount(prev => Math.max(0, prev - 1));
  }

  return (
    <div className={styles.bellWrap} ref={dropdownRef}>
      <button className={styles.bellBtn} onClick={() => setOpen(o => !o)} title="Notificações">
        <span className={styles.navIcon}>🔔</span>
        Notificações
        {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>Notificações</div>
          <div className={styles.notifList}>
            {notifications.length === 0 ? (
              <div className={styles.notifEmpty}>Nenhuma notificação</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`${styles.notifItem} ${!n.read_at ? styles.unread : ''}`}
                  onClick={() => { if (!n.read_at) markRead(n.id); }}
                >
                  <span className={styles.notifTitle}>{n.title}</span>
                  <span className={styles.notifBody}>{n.body}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BillingWarningBanner() {
  const { activeCondominium } = useAuth();
  if (!activeCondominium?.past_due_since) return null;

  const daysPastDue = Math.floor(
    (Date.now() - new Date(activeCondominium.past_due_since).getTime()) / 86_400_000,
  );
  const daysLeft = Math.max(0, 30 - daysPastDue);

  return (
    <div
      style={{
        background: '#FEF3C7',
        borderBottom: '1.5px solid #F59E0B',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '0.875rem',
        color: '#92400E',
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>⚠️</span>
      <span>
        Pagamento pendente. Seu acesso será bloqueado em{' '}
        <strong>{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong>.{' '}
        <a href="mailto:suporte@condocloud.com.br" style={{ color: '#92400E', textDecoration: 'underline' }}>
          Regularize agora
        </a>
        .
      </span>
    </div>
  );
}

export default function AppLayout() {
  const { user, signOut, isMultiCondo, systemState } = useAuth();
  const NAV_ITEMS = isMultiCondo ? [NAV_ITEM_OVERVIEW, ...NAV_ITEMS_BASE] : NAV_ITEMS_BASE;
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        {isMultiCondo && <CondominiumSwitcher />}

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <NotificationBell />

        <div className={styles.sidebarFooter}>
          <NavLink to="/profile" className={styles.userInfo} style={{ textDecoration: 'none' }}>
            <div className={styles.avatar}>
              {(user?.user_metadata?.['full_name'] as string)?.[0]?.toUpperCase() ??
                user?.email?.[0]?.toUpperCase() ??
                'S'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>
                {(user?.user_metadata?.['full_name'] as string) ?? 'Síndico'}
              </span>
              <span className={styles.userEmail}>{user?.email}</span>
            </div>
          </NavLink>
          <button className={styles.signOut} onClick={handleSignOut} title="Sair">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {systemState === 'billing_warning' && <BillingWarningBanner />}
        <Outlet />
      </main>
    </div>
  );
}
