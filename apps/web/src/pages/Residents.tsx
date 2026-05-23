import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface TipoMorador {
  id: string;
  nome: string;
}

interface Profile {
  id: string;
  name?: string;
  email?: string;
  role: string;
  tipo_morador?: string;
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

const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  desenvolvedor:          { label: 'Desenvolvedor',        bg: '#fef3c7', color: '#92400e' },
  sindico_administradora: { label: 'Sínd. Administradora', bg: '#ede9fe', color: '#5b21b6' },
  sindico:                { label: 'Síndico',              bg: '#dbeafe', color: '#1d4ed8' },
  morador:                { label: 'Morador',              bg: '#dcfce7', color: '#15803d' },
  prestador:              { label: 'Prestador',            bg: '#f3f4f6', color: '#374151' },
};

const ASSIGNABLE_ROLES: Record<string, string[]> = {
  desenvolvedor:          ['desenvolvedor', 'sindico_administradora', 'sindico', 'morador', 'prestador'],
  sindico_administradora: ['sindico', 'morador', 'prestador'],
  sindico:                ['sindico', 'morador', 'prestador'],
};

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
  value, onChange, currentUserRole, includeInviteOnly = false,
}: {
  value: string; onChange: (v: string) => void;
  currentUserRole: string; includeInviteOnly?: boolean;
}) {
  const allowed = includeInviteOnly
    ? INVITE_ROLES
    : (ASSIGNABLE_ROLES[currentUserRole] ?? ['morador', 'prestador']);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {allowed.map(r => <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>)}
    </select>
  );
}

function TipoMoradorSelect({
  value, onChange, tipos, disabled,
}: {
  value: string; onChange: (v: string) => void;
  tipos: TipoMorador[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      <option value="">— não informado —</option>
      {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
    </select>
  );
}

function RegisterModal({ onClose, onSaved, currentUserRole, tipos }: {
  onClose: () => void; onSaved: () => void;
  currentUserRole: string; tipos: TipoMorador[];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('morador');
  const [tipoMoradorId, setTipoMoradorId] = useState('');
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
      const tipoNome = tipos.find(t => t.id === tipoMoradorId)?.nome;
      const res = await api.post<ApiResponse<{ profile: Profile; temporary_password: string }>>('/auth/residents', {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        role,
        tipo_morador: tipoNome || undefined,
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
              <RoleSelect value={role} onChange={v => { setRole(v); if (v !== 'morador') setTipoMoradorId(''); }} currentUserRole={currentUserRole} />
            </div>
            <div className={styles.field}>
              <label>Tipo de morador</label>
              <TipoMoradorSelect value={tipoMoradorId} onChange={setTipoMoradorId} tipos={tipos} disabled={role !== 'morador'} />
            </div>
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

function EditModal({ profile, onClose, onSaved, currentUserRole, tipos }: {
  profile: Profile; onClose: () => void; onSaved: () => void;
  currentUserRole: string; tipos: TipoMorador[];
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '');
  const [whatsappOptIn, setWhatsappOptIn] = useState(profile.whatsapp_opt_in ?? false);
  const [role, setRole] = useState(profile.role);
  const [tipoMoradorId, setTipoMoradorId] = useState(() => {
    const match = tipos.find(t => t.nome === profile.tipo_morador);
    return match?.id ?? '';
  });
  const [unitId, setUnitId] = useState(profile.unit_id ?? '');
  const [active, setActive] = useState(profile.active);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canEditRole = currentUserRole === 'desenvolvedor' ||
    !['desenvolvedor', 'sindico_administradora'].includes(profile.role);

  useEffect(() => {
    api.get<ApiResponse<Unit[]>>('/condominium/units').then(r => setUnits(r.data ?? [])).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const tipoNome = tipos.find(t => t.id === tipoMoradorId)?.nome ?? null;
      await api.patch(`/auth/profiles/${profile.id}`, {
        name: name || undefined,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        whatsapp_opt_in: whatsappOptIn,
        role,
        tipo_morador: tipoNome,
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
                <RoleSelect value={role} onChange={v => { setRole(v); if (v !== 'morador') setTipoMoradorId(''); }} currentUserRole={currentUserRole} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RoleBadge role={profile.role} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Apenas desenvolvedor pode alterar</span>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label>Tipo de morador</label>
              <TipoMoradorSelect value={tipoMoradorId} onChange={setTipoMoradorId} tipos={tipos} disabled={role !== 'morador'} />
            </div>
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

function TiposTab({ tipos, onChanged }: { tipos: TipoMorador[]; onChanged: () => void }) {
  const [novoNome, setNovoNome] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/tipos-morador', { nome: novoNome.trim() });
      setNovoNome('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editNome.trim()) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/tipos-morador/${id}`, { nome: editNome.trim() });
      setEditId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir o tipo "${nome}"?`)) return;
    try {
      await api.delete(`/tipos-morador/${id}`);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={styles.tableWrap}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', background: '#fafaf8' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Defina os tipos de morador disponíveis para seleção ao cadastrar ou editar um morador (ex: Proprietário, Inquilino, Dependente).
          </p>
        </div>

        {tipos.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Nenhum tipo cadastrado ainda.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tipos.map(t => (
                <tr key={t.id}>
                  <td>
                    {editId === t.id ? (
                      <input
                        value={editNome}
                        onChange={e => setEditNome(e.target.value)}
                        style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, fontFamily: 'var(--sans)', width: '100%', maxWidth: 280 }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdate(t.id); if (e.key === 'Escape') setEditId(null); }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{t.nome}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {editId === t.id ? (
                      <>
                        <button className={styles.btnPrimary} style={{ padding: '5px 14px', fontSize: 13, marginRight: 6 }} disabled={saving} onClick={() => handleUpdate(t.id)}>
                          {saving ? '…' : 'Salvar'}
                        </button>
                        <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: 13 }} onClick={() => setEditId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className={styles.iconBtn} title="Editar" onClick={() => { setEditId(t.id); setEditNome(t.nome); setError(''); }}>✏️</button>
                        <button className={styles.iconBtn} title="Excluir" onClick={() => handleDelete(t.id, t.nome)}>🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={handleCreate} style={{ padding: '14px 20px', borderTop: tipos.length > 0 ? '1px solid var(--line)' : undefined, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Novo tipo (ex: Proprietário)"
            style={{ flex: 1, padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
          />
          <button type="submit" className={styles.btnPrimary} disabled={saving || !novoNome.trim()}>
            {saving ? 'Criando…' : '+ Criar'}
          </button>
        </form>

        {error && <div className={styles.error} style={{ margin: '0 20px 14px' }}>{error}</div>}
      </div>
    </div>
  );
}

export default function Residents() {
  const { profile: currentUser } = useAuth();
  const currentUserRole = currentUser?.role ?? 'morador';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tipos, setTipos] = useState<TipoMorador[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'residents' | 'invites' | 'tipos'>('residents');

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
      const [profRes, invRes, tiposRes] = await Promise.all([
        api.get<ApiResponse<Profile[]>>('/auth/profiles'),
        api.get<ApiResponse<Invite[]>>('/invites'),
        api.get<ApiResponse<TipoMorador[]>>('/tipos-morador'),
      ]);
      setProfiles(profRes.data);
      setInvites(invRes.data);
      setTipos(tiposRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadTipos() {
    const res = await api.get<ApiResponse<TipoMorador[]>>('/tipos-morador');
    setTipos(res.data ?? []);
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

  const roleOrder = ['desenvolvedor', 'sindico_administradora', 'sindico', 'morador', 'prestador'];
  const sortedProfiles = [...profiles].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role),
  );

  const isAdmin = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(currentUserRole);

  return (
    <div className={styles.page}>
      {showRegister && (
        <RegisterModal
          currentUserRole={currentUserRole}
          tipos={tipos}
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
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="usuario@email.com" />
              </div>
              <div className={styles.field}>
                <label>Perfil</label>
                <RoleSelect value={inviteRole} onChange={setInviteRole} currentUserRole={currentUserRole} includeInviteOnly />
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Para perfis superiores, use Cadastrar diretamente.
                </span>
              </div>
              {inviteMsg && (
                <div className={inviteMsg.startsWith('Link') ? styles.success : styles.error} style={{ wordBreak: 'break-all', fontSize: 13 }}>
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
          tipos={tipos}
          onClose={() => setEditProfile(null)}
          onSaved={() => { setEditProfile(null); load(); }}
        />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Usuários</h1>
          <p className={styles.subtitle}>Gerencie perfis de acesso e convites.</p>
        </div>
        {tab !== 'tipos' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnPrimary} onClick={() => setShowRegister(true)}>+ Cadastrar</button>
            <button className={styles.btnPrimary} onClick={() => { setShowInvite(true); setInviteMsg(''); }}>+ Convidar</button>
          </div>
        )}
      </div>

      <div className={styles.filters}>
        <button className={`${styles.filterBtn} ${tab === 'residents' ? styles.filterActive : ''}`} onClick={() => setTab('residents')}>
          Usuários ({profiles.length})
        </button>
        <button className={`${styles.filterBtn} ${tab === 'invites' ? styles.filterActive : ''}`} onClick={() => setTab('invites')}>
          Convites ({invites.length})
        </button>
        {isAdmin && (
          <button className={`${styles.filterBtn} ${tab === 'tipos' ? styles.filterActive : ''}`} onClick={() => setTab('tipos')}>
            Tipos de morador ({tipos.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : tab === 'tipos' ? (
        <TiposTab tipos={tipos} onChanged={loadTipos} />
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
                  <th>Tipo</th>
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
                        <Link to={`/residents/${p.id}`} style={{ color: 'var(--green-dark)', textDecoration: 'none', fontWeight: 600 }}>
                          {p.name ?? '—'}
                        </Link>
                      </td>
                      <td className={styles.tdMuted}>{p.email ?? '—'}</td>
                      <td className={styles.tdMono}>
                        {p.units ? `${p.units.blocks?.name ?? ''} ${p.units.number}`.trim() : '—'}
                      </td>
                      <td><RoleBadge role={p.role} /></td>
                      <td className={styles.tdMuted}>{p.tipo_morador ?? '—'}</td>
                      <td>
                        <span className={styles.badge} style={{
                          background: p.active ? '#dcfce7' : '#f3f4f6',
                          color: p.active ? '#15803d' : '#6b7280',
                        }}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link to={`/residents/${p.id}`} className={styles.btnSmall} style={{ background: '#f0fdf4', color: 'var(--green-dark)', padding: '4px 10px', borderRadius: 999, fontWeight: 600, fontSize: 12, textDecoration: 'none', marginRight: 4, display: 'inline-block' }}>
                          Ver perfil
                        </Link>
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
                        <button className={styles.iconBtn} title="Copiar link"
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/convite/${inv.token}`)}>
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
