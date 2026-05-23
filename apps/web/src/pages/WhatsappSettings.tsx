import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';
import wa from './WhatsappSettings.module.css';

interface ProfileWa {
  id: string;
  name?: string;
  role: string;
  whatsapp?: string;
  whatsapp_opt_in: boolean;
  units?: { number: string }[] | null;
}

interface Settings {
  disabled_events: string[];
  profiles: ProfileWa[];
}

interface ApiResponse<T> { data: T }

const ROLE_LABEL: Record<string, string> = {
  desenvolvedor: 'Dev',
  sindico_administradora: 'Sínd. Adm.',
  sindico: 'Síndico',
  morador: 'Morador',
  prestador: 'Prestador',
};

const EVENTS = [
  {
    name: 'TICKET_RESOLVED',
    label: 'Chamado resolvido',
    icon: '✅',
    trigger: 'Síndico resolve um chamado',
    recipients: 'Quem abriu o chamado',
  },
  {
    name: 'INVITE_ACCEPTED',
    label: 'Novo morador',
    icon: '👋',
    trigger: 'Morador aceita convite',
    recipients: 'Todos os síndicos ativos',
  },
  {
    name: 'PROPOSAL_INTERACTION',
    label: 'Voto em proposta',
    icon: '👍',
    trigger: 'Alguém vota numa proposta',
    recipients: 'Criador da proposta',
  },
  {
    name: 'PROPOSAL_STATUS_CHANGED',
    label: 'Proposta convertida',
    icon: '🎉',
    trigger: 'Proposta marcada como aprovada',
    recipients: 'Criador da proposta',
  },
  {
    name: 'ROI_UPDATED',
    label: 'Resumo diário',
    icon: '📊',
    trigger: 'Job diário de métricas',
    recipients: 'Síndicos e administradores',
  },
  {
    name: 'CHARGE_CREATED',
    label: 'Cobrança emitida',
    icon: '💰',
    trigger: 'Síndico emite uma nova cobrança',
    recipients: 'Morador vinculado à cobrança',
  },
  {
    name: 'MESSAGE_PUBLISHED',
    label: 'Novo comunicado',
    icon: '📢',
    trigger: 'Síndico publica um comunicado',
    recipients: 'Moradores e prestadores do público-alvo',
  },
  {
    name: 'TICKET_CREATED',
    label: 'Novo chamado',
    icon: '🎫',
    trigger: 'Morador abre um chamado',
    recipients: 'Síndicos ativos',
  },
] as const;

export default function WhatsappSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingEvent, setTogglingEvent] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState<string | null>(null);
  const [editingWa, setEditingWa] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ApiResponse<Settings>>('/whatsapp-settings');
      setSettings(res.data);
    } catch {
      setError('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleEvent(eventName: string, currentlyDisabled: boolean) {
    if (!settings) return;
    setTogglingEvent(eventName);

    const nextDisabled = currentlyDisabled
      ? settings.disabled_events.filter((e) => e !== eventName)
      : [...settings.disabled_events, eventName];

    setSettings({ ...settings, disabled_events: nextDisabled });

    try {
      await api.patch<ApiResponse<{ disabled_events: string[] }>>('/whatsapp-settings/events', {
        event: eventName,
        enabled: currentlyDisabled,
      });
    } catch {
      setSettings(settings);
    } finally {
      setTogglingEvent(null);
    }
  }

  async function saveProfileWa(profileId: string, patch: { whatsapp?: string; whatsapp_opt_in?: boolean }) {
    if (!settings) return;
    setSavingProfile(profileId);
    try {
      await api.patch(`/whatsapp-settings/profiles/${profileId}`, patch);
      setSettings({
        ...settings,
        profiles: settings.profiles.map((p) =>
          p.id === profileId ? { ...p, ...patch } : p,
        ),
      });
      if (patch.whatsapp !== undefined) {
        setEditingWa((prev) => { const next = { ...prev }; delete next[profileId]; return next; });
      }
    } catch {
      /* ignora — mantém estado anterior */
    } finally {
      setSavingProfile(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Notificações WhatsApp</h1>
          <p className={styles.subtitle}>
            Gerencie quais eventos disparam mensagens e o opt-in de cada usuário
          </p>
        </div>
      </div>

      {/* ── Eventos ── */}
      <section>
        <h2 className={wa.sectionTitle}>Eventos</h2>
        <div className={wa.eventGrid}>
          {EVENTS.map((ev) => {
            const disabled = settings.disabled_events.includes(ev.name);
            const busy = togglingEvent === ev.name;
            return (
              <div key={ev.name} className={`${wa.eventCard} ${disabled ? wa.eventCardOff : ''}`}>
                <div className={wa.eventCardHeader}>
                  <span className={wa.eventIcon}>{ev.icon}</span>
                  <span className={wa.eventLabel}>{ev.label}</span>
                  <button
                    className={`${wa.toggleBtn} ${disabled ? wa.toggleOff : wa.toggleOn}`}
                    disabled={busy}
                    onClick={() => toggleEvent(ev.name, disabled)}
                    title={disabled ? 'Ativar evento' : 'Desativar evento'}
                  >
                    {busy ? '…' : disabled ? 'Desativado' : 'Ativo'}
                  </button>
                </div>
                <div className={wa.eventMeta}>
                  <span className={wa.metaRow}><span className={wa.metaKey}>Gatilho</span>{ev.trigger}</span>
                  <span className={wa.metaRow}><span className={wa.metaKey}>Destinatário</span>{ev.recipients}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Usuários ── */}
      <section>
        <h2 className={wa.sectionTitle}>Usuários</h2>
        {settings.profiles.length === 0 ? (
          <div className={styles.empty}>Nenhum usuário ativo neste condomínio.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Unidade</th>
                  <th>Perfil</th>
                  <th>WhatsApp</th>
                  <th style={{ textAlign: 'center' }}>Recebe notificações</th>
                </tr>
              </thead>
              <tbody>
                {settings.profiles.map((p) => {
                  const isEditingWa = p.id in editingWa;
                  const isSaving = savingProfile === p.id;
                  const unit = p.units?.[0]?.number;

                  return (
                    <tr key={p.id}>
                      <td>{p.name ?? '—'}</td>
                      <td className={styles.tdMuted}>{unit ? `Unid. ${unit}` : '—'}</td>
                      <td>
                        <span className={styles.badge} style={{ background: '#f3f4f6', color: '#374151' }}>
                          {ROLE_LABEL[p.role] ?? p.role}
                        </span>
                      </td>
                      <td>
                        {isEditingWa ? (
                          <span className={wa.inlineEdit}>
                            <input
                              className={wa.inlineInput}
                              value={editingWa[p.id]}
                              onChange={(e) => setEditingWa((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="5535999990000"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveProfileWa(p.id, { whatsapp: editingWa[p.id] || undefined });
                                if (e.key === 'Escape') setEditingWa((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
                              }}
                              autoFocus
                              disabled={isSaving}
                            />
                            <button
                              className={`${styles.btnSmall} ${styles.btnSmallGreen}`}
                              disabled={isSaving}
                              onClick={() => saveProfileWa(p.id, { whatsapp: editingWa[p.id] || undefined })}
                            >
                              {isSaving ? '…' : '✓'}
                            </button>
                            <button
                              className={styles.btnSmall}
                              onClick={() => setEditingWa((prev) => { const next = { ...prev }; delete next[p.id]; return next; })}
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            className={wa.waNumber}
                            title="Clique para editar"
                            onClick={() => setEditingWa((prev) => ({ ...prev, [p.id]: p.whatsapp ?? '' }))}
                          >
                            {p.whatsapp ? p.whatsapp : <span className={wa.waEmpty}>+ adicionar</span>}
                            <span className={wa.editHint}>✏️</span>
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label className={wa.optInLabel}>
                          <input
                            type="checkbox"
                            checked={p.whatsapp_opt_in}
                            disabled={isSaving || !p.whatsapp}
                            onChange={(e) => saveProfileWa(p.id, { whatsapp_opt_in: e.target.checked })}
                          />
                          {p.whatsapp_opt_in
                            ? <span className={wa.optInOn}>Sim</span>
                            : <span className={wa.optInOff}>{p.whatsapp ? 'Não' : 'Sem número'}</span>}
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
