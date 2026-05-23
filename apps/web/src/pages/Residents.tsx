import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface Profile {
  id: string;
  name?: string;
  email?: string;
  role: string;
  phone?: string;
  whatsapp?: string;
  whatsapp_opt_in?: boolean;
  active: boolean;
  unit_id?: string;
  units?: { number: string; blocks?: { name: string } };
}

interface Invite {
  id: string;
  token: string;
  email?: string;
  role: string;
  status: string;
  created_at: string;
}

interface Unit {
  id: string;
  number: string;
  blocks?: { name: string };
}

interface ApiResponse<T> { data: T }

// Mapa de label e cor por role
const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  desenvolvedor:         { label: 'Desenvolvedor',      bg: '#fef3c7', color: '#92400e' },
  sindico_administradora:{ label: 'Sínd. Administradora', bg: '#ede9fe', color: '#5b21b6' },
  sindico:               { label: 'Síndico',            bg: '#dbeafe', color: '#1d4ed8' },
  morador:               { label: 'Morador',            bg: '#dcfce7', color: '#15803d' },
  prestador:             { label: 'Prestador',          bg: '#f3f4f6', color: '#374151' },
};

// Roles que cada nível pode atribuir
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  desenvolvedor:          ['desenvolvedor', 'sindico_administradora', 'sindico', 'morador', 'prestador'],
  sindico_administradora: ['sindico', 'morador', 'prestador'],
  sindico:                ['sindico', 'morador', 'prestador'],
};

// Roles válidos para convite (apenas quem entra pelo link)
const INVITE_ROLES = ['morador', 'prestador'];

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, bg: '#f3f4f6', color: '#374151' };
  return (
    <span className={styles.badge} style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function RoleSelect({
  value,
  onChange,
  currentUserRole,
  includeInviteOnly = false,
}: {
  value: string;
  onChange: (v: string) => void;
  currentUserRole: string;
  includeInviteOnly?: boolean;
}) {
  const allowed = includeInviteOnly
    ? INVITE_ROLES
    : (ASSIGNABLE_ROLES[currentUserRole] ?? ['morador', 'prestador']);

  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {allowed.map(r => (
        <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
      ))}
    </select>
  );
}

function RegisterModal({ onClose, onSaved, currentUserRole }: {
  onClose: () => void;
  onSaved: () => void;
  currentUserRole: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('morador');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    api.get<ApiResponse<Unit[]>>('/condominium/units').then(r => setUnits(r.data ?? [])).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(''); setTempPassword('');
    try {
      const res = await api.post<ApiResponse<{ profile: Profile; temporary_password: string }>>('/auth/residents', {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        role,
        unit_id: unitId || undefined,
      });
      setTempPassword(res.data.temporary_password ?? '—');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  if (tempPassword) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <h2 className={styles.modalTitle}>Usuário cadastrado ✓</h2>
          <div className={styles.form}>
            <div style={{ background: '#f0f9f4', border: '1px solid #16a869', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>Senha temporária:</p>
              <p style={{ margin: 0, fontSize: 14, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink)', wordBreak: 'break-all' }}>
                {tempPassword}
              </p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              O usuário pode usar essa senha na primeira vez e trocá-la depois em seu perfil.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={() => { onSaved(); onClose(); }}>Entendi</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Cadastrar usuário</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label>Nome *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva" required />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="joao@email.com" />
              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Se não preenchido, um e-mail interno será gerado
              </span>
            </div>
            <div className={styles.field}>
              <label>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Perfil</label>
              <RoleSelect value={role} onChange={setRole} currentUserRole={currentUserRole} />
            </div>
            <div className={styles.field}>
              <label>Unidade</label>
              <select value={unitId} onChange={e => setUnitId(e.target.value)}>
                <option value="">— sem unidade —</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.blocks?.name ? `${u.blocks.name} - ` : ''}{u.number}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ profile, onClose, onSaved, currentUserRole }: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
  currentUserRole: string;
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '');
  const [whatsappOptIn, setWhatsappOptIn] = useState(profile.whatsapp_opt_in ?? false);
  const [role, setRole] = useState(profile.role);
  const [unitId, setUnitId] = useState(profile.unit_id ?? '');
  const [active, setActive] = useState(profile.active);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Síndico não pode editar desenvolvedor ou sindico_administradora
  const canEditRole = currentUserRole === 'desenvolvedor' ||
    !['desenvolvedor', 'sindico_administradora'].includes(profile.role);

  useEffect(() => {
    api.get<ApiResponse<Unit[]>>('/condominium/units').then(r => setUnits(r.data ?? [])).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.patch(`/auth/profiles/${profile.id}`, {
        name: name || undefined,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        whatsapp_opt_in: whatsappOptIn,
        role,
        unit_id: unitId || null,
        active,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Editar usuário</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>WhatsApp</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5511999999999" />
            </div>
            <div className={styles.field} style={{ justifyContent: 'flex-end' }}>
              <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={whatsappOptIn} onChange={e => setWhatsappOptIn(e.target.checked)} />
                Aceita notificações por WhatsApp
              </label>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Perfil</label>
              {canEditRole ? (
                <RoleSelect value={role} onChange={setRole} currentUserRole={currentUserRole} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RoleBadge role={profile.role} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Apenas desenvolvedor pode alterar
                  </span>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label>Unidade</label>
              <select value={unitId} onChange={e => setUnitId(e.target.value)}>
                <option value="">— sem unidade —</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.blocks?.name ? `${u.blocks.name} - ` : ''}{u.number}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              Conta ativa
            </label>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Residents() {
  const { profile: currentUser } = useAuth();
  const currentUserRole = currentUser?.role ?? 'morador';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'residents' | 'invites'>('residents');

  const [showInvite, setShowInvite] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('morador');
  const [inviteMsg, setInviteMsg] = useState('');

  const [editProfile, setEditProfile] = useState<Profile | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [profRes, invRes] = await Promise.all([
        api.get<ApiResponse<Profile[]>>('/auth/profiles'),
        api.get<ApiResponse<Invite[]>>('/invites'),
      ]);
      setProfiles(profRes.data);
      setInvites(invRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInvite() {
    setInviting(true); setInviteMsg('');
    try {
      const res = await api.post<ApiResponse<{ token: string }>>('/invites', {
        email: inviteEmail || undefined,
        role: inviteRole,
      });
      const link = `${window.location.origin}/convite/${res.data.token}`;
      setInviteMsg(`Link gerado: ${link}`);
      setInviteEmail('');
      load();
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : 'Erro ao gerar convite');
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(p: Profile) {
    // Bloqueia exclusão de desenvolvedor ou sindico_administradora por síndicos
    if (['desenvolvedor', 'sindico_administradora'].includes(p.role) && currentUserRole !== 'desenvolvedor') {
      alert('Apenas o desenvolvedor pode remover este perfil.');
      return;
    }
    if (!confirm(`Remover ${p.name ?? p.email ?? 'este usuário'} do condomínio?`)) return;
    try {
      await api.delete(`/auth/profiles/${p.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  // Agrupa perfis por role para exibição organizada
  const roleOrder = ['desenvolvedor', 'sindico_administradora', 'sindico', 'morador', 'prestador'];
  const sortedProfiles = [...profiles].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role),
  );

  return (
    <div className={styles.page}>
      {showRegister && (
        <RegisterModal
          currentUserRole={currentUserRole}
          onClose={() => setShowRegister(false)}
          onSaved={() => { setShowRegister(false); load(); }}
        />
      )}

      {showInvite && (
        <div className={styles.overlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Convidar usuário</h2>
            <div className={styles.form}>
              <div className={styles.field}>
                <label>E-mail (opcional)</label>
                <input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="usuario@email.com"
                />
              </div>
              <div className={styles.field}>
                <label>Perfil</label>
                <RoleSelect
                  value={inviteRole}
                  onChange={setInviteRole}
                  currentUserRole={currentUserRole}
                  includeInviteOnly
                />
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Para perfis superiores, use Cadastrar diretamente.
                </span>
              </div>
              {inviteMsg && (
                <div
                  className={inviteMsg.startsWith('Link') ? styles.success : styles.error}
                  style={{ wordBreak: 'break-all', fontSize: 13 }}
                >
                  {inviteMsg}
                </div>
              )}
              <div className={styles.modalActions}>
                <button className={styles.btnSecondary} onClick={() => setShowInvite(false)}>Fechar</button>
                <button className={styles.btnPrimary} disabled={inviting} onClick={handleInvite}>
                  {inviting ? 'Gerando…' : 'Gerar link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editProfile && (
        <EditModal
          profile={editProfile}
          currentUserRole={currentUserRole}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); load(); }}
        />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Usuários</h1>
          <p className={styles.subtitle}>Gerencie perfis de acesso e convites.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.btnPrimary} onClick={() => setShowRegister(true)}>+ Cadastrar</button>
          <button className={styles.btnPrimary} onClick={() => { setShowInvite(true); setInviteMsg(''); }}>+ Convidar</button>
        </div>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${tab === 'residents' ? styles.filterActive : ''}`}
          onClick={() => setTab('residents')}
        >
          Usuários ({profiles.length})
        </button>
        <button
          className={`${styles.filterBtn} ${tab === 'invites' ? styles.filterActive : ''}`}
          onClick={() => setTab('invites')}
        >
          Convites ({invites.length})
        </button>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : tab === 'residents' ? (
        sortedProfiles.length === 0 ? (
          <div className={styles.empty}><span>👥</span><p>Nenhum usuário cadastrado ainda.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Unidade</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedProfiles.map(p => {
                  const canEdit = currentUserRole === 'desenvolvedor' ||
                    !['desenvolvedor', 'sindico_administradora'].includes(p.role);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link to={`/residents/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--green-dark)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}>
                          {p.name ?? '—'}
                        </Link>
                      </td>
                      <td className={styles.tdMuted}>{p.email ?? '—'}</td>
                      <td className={styles.tdMono}>
                        {p.units ? `${p.units.blocks?.name ?? ''} ${p.units.number}`.trim() : '—'}
                      </td>
                      <td><RoleBadge role={p.role} /></td>
                      <td>
                        <span className={styles.badge} style={{
                          background: p.active ? '#dcfce7' : '#f3f4f6',
                          color: p.active ? '#15803d' : '#6b7280',
                        }}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {canEdit && (
                          <button className={styles.iconBtn} title="Editar" onClick={() => setEditProfile(p)}>✏️</button>
                        )}
                        <button className={styles.iconBtn} title="Novo convite" onClick={() => {
                          setInviteRole(INVITE_ROLES.includes(p.role) ? p.role : 'morador');
                          setInviteEmail(p.email ?? '');
                          setInviteMsg('');
                          setShowInvite(true);
                        }}>📋</button>
                        {canEdit && (
                          <button className={styles.iconBtn} title="Remover" onClick={() => handleDelete(p)}>🗑️</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        invites.length === 0 ? (
          <div className={styles.empty}><span>✉️</span><p>Nenhum convite gerado.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td className={styles.tdMuted}>{inv.email ?? 'Qualquer pessoa com o link'}</td>
                    <td><RoleBadge role={inv.role} /></td>
                    <td>
                      <span className={styles.badge} style={{
                        background: inv.status === 'accepted' ? '#dcfce7' : inv.status === 'pending' ? '#fef3c7' : '#f3f4f6',
                        color: inv.status === 'accepted' ? '#15803d' : inv.status === 'pending' ? '#92400e' : '#6b7280',
                      }}>
                        {inv.status === 'accepted' ? 'Aceito' : inv.status === 'pending' ? 'Pendente' : inv.status}
                      </span>
                    </td>
                    <td className={styles.tdMuted}>{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {inv.status === 'pending' && (
                        <button
                          className={styles.iconBtn}
                          title="Copiar link"
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/convite/${inv.token}`)}
                        >
                          📋
                        </button>
                      )}
                    </td>
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
