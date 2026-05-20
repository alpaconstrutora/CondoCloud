import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';
import cs from './CondoSettings.module.css';

interface ApiResp<T> { data: T }
interface Profile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  sindico: 'Síndico',
  admin: 'Administrador',
  morador: 'Morador',
  porteiro: 'Porteiro',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    api.get<ApiResp<Profile>>('/auth/me')
      .then(r => {
        setProfile(r.data);
        setName(r.data.name ?? '');
        setPhone(r.data.phone ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await api.patch('/auth/profile', {
        name: name || undefined,
        phone: phone || undefined,
      });
      setMsg('Salvo!');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwMsg('As senhas não coincidem'); return; }
    if (newPw.length < 6) { setPwMsg('A nova senha deve ter ao menos 6 caracteres'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await api.post('/auth/change-password', { current_password: currentPw, new_password: newPw });
      setPwMsg('Senha alterada!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(''), 3000);
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : 'Erro ao alterar senha');
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Meu Perfil</h1>
          <p className={styles.subtitle}>Gerencie suas informações pessoais e acesso.</p>
        </div>
      </div>

      <section className={cs.card}>
        <h2 className={cs.sectionTitle}>Informações pessoais</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--green-dark)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
          }}>
            {name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{name || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {profile?.email ?? user?.email} · {ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}
            </div>
          </div>
        </div>

        <form onSubmit={saveProfile} noValidate>
          <div className={cs.grid2}>
            <div className={styles.field}>
              <label>Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className={styles.field}>
              <label>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className={cs.formFooter}>
            {msg && <span className={msg === 'Salvo!' ? cs.msgOk : cs.msgErr}>{msg}</span>}
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </section>

      <section className={cs.card}>
        <h2 className={cs.sectionTitle}>Alterar senha</h2>
        <form onSubmit={changePassword} noValidate>
          <div className={cs.grid1}>
            <div className={styles.field}>
              <label>Senha atual</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </div>
          </div>
          <div className={cs.grid2}>
            <div className={styles.field}>
              <label>Nova senha</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className={styles.field}>
              <label>Confirmar nova senha</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <div className={cs.formFooter}>
            {pwMsg && <span className={pwMsg === 'Senha alterada!' ? cs.msgOk : cs.msgErr}>{pwMsg}</span>}
            <button type="submit" className={styles.btnPrimary} disabled={pwSaving}>
              {pwSaving ? 'Alterando…' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
