import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface Unit {
  id: string;
  number: string;
  blocks?: { name: string };
}

interface TipoMorador {
  id: string;
  nome: string;
}

interface Profile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  whatsapp_opt_in?: boolean;
  role: string;
  tipo_morador?: string;
  unit_id?: string;
  units?: { number: string; blocks?: { name: string } };
  active: boolean;
  created_at: string;
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

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? { label: role, bg: '#f3f4f6', color: '#374151' };
  return (
    <span className={styles.badge} style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

export default function ResidentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: currentUser } = useAuth();
  const currentUserRole = currentUser?.role ?? 'morador';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tipos, setTipos] = useState<TipoMorador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [role, setRole] = useState('morador');
  const [unitId, setUnitId] = useState('');
  const [active, setActive] = useState(true);
  const [tipoMorador, setTipoMorador] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!id) return;
    try {
      const [profRes, unitsRes, tiposRes] = await Promise.all([
        api.get<ApiResponse<Profile>>(`/auth/profiles/${id}`),
        api.get<ApiResponse<Unit[]>>('/condominium/units'),
        api.get<ApiResponse<TipoMorador[]>>('/tipos-morador'),
      ]);
      const p = profRes.data;
      setProfile(p);
      setUnits(unitsRes.data ?? []);
      setTipos(tiposRes.data ?? []);
      setName(p.name ?? '');
      setPhone(p.phone ?? '');
      setWhatsapp(p.whatsapp ?? '');
      setWhatsappOptIn(p.whatsapp_opt_in ?? false);
      setRole(p.role);
      setTipoMorador(p.tipo_morador ?? '');
      setUnitId(p.unit_id ?? '');

      setActive(p.active);
    } catch {
      navigate('/residents', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const canEdit = currentUserRole === 'desenvolvedor' ||
    !['desenvolvedor', 'sindico_administradora'].includes(profile?.role ?? '');

  const canEditRole = currentUserRole === 'desenvolvedor' ||
    !['desenvolvedor', 'sindico_administradora'].includes(profile?.role ?? '');

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/auth/profiles/${id}`, {
        name: name || undefined,
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        whatsapp_opt_in: whatsappOptIn,
        role,
        tipo_morador: tipoMorador || null,
        unit_id: unitId || null,
        active,
      });
      setEditing(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id || !profile) return;
    if (!confirm(`Remover ${profile.name ?? profile.email ?? 'este usuário'} do condomínio?`)) return;
    try {
      await api.delete(`/auth/profiles/${id}`);
      navigate('/residents', { replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  function cancelEdit() {
    if (!profile) return;
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
    setWhatsapp(profile.whatsapp ?? '');
    setWhatsappOptIn(profile.whatsapp_opt_in ?? false);
    setRole(profile.role);
    setTipoMorador(profile.tipo_morador ?? '');
    setUnitId(profile.unit_id ?? '');
    setActive(profile.active);
    setError('');
    setEditing(false);
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const unitLabel = profile.units
    ? `${profile.units.blocks?.name ? `${profile.units.blocks.name} - ` : ''}${profile.units.number}`
    : '—';

  return (
    <div className={styles.page}>
      <Link to="/residents" className={styles.backLink}>← Voltar para Usuários</Link>

      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--green-dark)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>
            {(profile.name ?? profile.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{profile.name ?? '—'}</h1>
            <p className={styles.subtitle}>{profile.email ?? '—'}</p>
          </div>
        </div>

        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.btnSecondary} onClick={() => setEditing(true)}>Editar</button>
            <button
              className={styles.btnSecondary}
              style={{ color: '#c0334d', borderColor: '#ffc0cb' }}
              onClick={handleDelete}
            >
              Remover
            </button>
          </div>
        )}
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          {editing ? (
            <form onSubmit={handleSave} noValidate>
              <h2 className={styles.detailCardTitle}>Editar perfil</h2>
              <div className={styles.form}>
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
                      <input
                        type="checkbox"
                        checked={whatsappOptIn}
                        onChange={e => setWhatsappOptIn(e.target.checked)}
                      />
                      Aceita notificações WhatsApp
                    </label>
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Perfil</label>
                    {canEditRole ? (
                      <select value={role} onChange={e => { setRole(e.target.value); if (e.target.value !== 'morador') setTipoMorador(''); }}>
                        {(ASSIGNABLE_ROLES[currentUserRole] ?? ['morador', 'prestador']).map(r => (
                          <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                        ))}
                      </select>
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
                    <label>Tipo de morador</label>
                    <select value={tipoMorador} onChange={e => setTipoMorador(e.target.value)} disabled={role !== 'morador'}>
                      <option value="">— não informado —</option>
                      {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </select>
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

                <div className={styles.modalActions} style={{ marginTop: 8 }}>
                  <button type="button" className={styles.btnSecondary} onClick={cancelEdit}>Cancelar</button>
                  <button type="submit" className={styles.btnPrimary} disabled={saving}>
                    {saving ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              <h2 className={styles.detailCardTitle}>Informações do perfil</h2>
              <div className={styles.meta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Nome</span>
                  <span className={styles.metaVal}>{profile.name ?? '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>E-mail</span>
                  <span className={styles.metaVal}>{profile.email ?? '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Telefone</span>
                  <span className={styles.metaVal}>{profile.phone ?? '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>WhatsApp</span>
                  <span className={styles.metaVal}>{profile.whatsapp ?? '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Notif. WhatsApp</span>
                  <span className={styles.metaVal}>
                    {profile.whatsapp_opt_in ? 'Habilitado' : 'Desabilitado'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Acesso e unidade</h2>
            <div className={styles.meta}>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Perfil</span>
                <RoleBadge role={profile.role} />
              </div>
              {profile.role === 'morador' && (
                <div className={styles.metaRow}>
                  <span className={styles.metaKey}>Tipo</span>
                  <span className={styles.metaVal}>{profile.tipo_morador ?? '—'}</span>
                </div>
              )}
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Unidade</span>
                <span className={styles.metaVal}>{unitLabel}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Status</span>
                <span className={styles.badge} style={{
                  background: profile.active ? '#dcfce7' : '#f3f4f6',
                  color: profile.active ? '#15803d' : '#6b7280',
                }}>
                  {profile.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Cadastrado em</span>
                <span className={styles.metaVal}>
                  {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {canEdit && !editing && (
            <div className={styles.detailCard}>
              <h2 className={styles.detailCardTitle}>Ações rápidas</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => setEditing(true)}>
                  Editar perfil
                </button>
                <button
                  className={styles.btnSecondary}
                  style={{ color: '#c0334d', borderColor: '#ffc0cb', width: '100%' }}
                  onClick={handleDelete}
                >
                  Remover do condomínio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
