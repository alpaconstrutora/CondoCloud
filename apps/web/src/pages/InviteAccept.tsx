import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import styles from './auth/Auth.module.css';

interface InviteData {
  invite: { role: string; email?: string };
  condominium_name: string;
}

type Step = 'loading' | 'info' | 'auth' | 'accept' | 'done' | 'error';

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: InviteData }>(`/invites/${token}`)
      .then(res => {
        setInvite(res.data);
        if (res.data.invite.email) setEmail(res.data.invite.email);
        supabase.auth.getSession().then(async ({ data }) => {
          if (!data.session) { setStep('info'); return; }
          // Se já está logado como admin/síndico, faz logout primeiro para evitar sobrescrever o perfil
          try {
            const me = await api.get<{ data: { role: string; condominium_id?: string } }>('/auth/me');
            if (me.data?.condominium_id && ['sindico', 'admin'].includes(me.data.role ?? '')) {
              await supabase.auth.signOut();
              setStep('info');
              return;
            }
          } catch { /* ignora */ }
          setStep('accept');
        });
      })
      .catch(err => {
        setErrorMsg(err instanceof Error ? err.message : 'Convite inválido ou expirado');
        setStep('error');
      });
  }, [token]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
      }
      setStep('accept');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro de autenticação');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('Informe seu nome.'); return; }
    setLoading(true);
    setErrorMsg('');
    try {
      await api.post(`/invites/${token}/accept`, { name, phone: phone || undefined });
      setStep('done');
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao aceitar convite');
    } finally {
      setLoading(false);
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    morador: 'Morador',
    porteiro: 'Porteiro',
    admin: 'Administrador',
    sindico: 'Síndico',
  };

  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 440 }}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        {step === 'loading' && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>Verificando convite…</p>
        )}

        {step === 'error' && (
          <>
            <h2 className={styles.title}>Convite inválido</h2>
            <p className={styles.subtitle} style={{ color: '#c0334d' }}>{errorMsg}</p>
            <button className={styles.btnPrimary} onClick={() => navigate('/')}>Ir para o início</button>
          </>
        )}

        {step === 'info' && invite && (
          <>
            <h2 className={styles.title}>Você foi convidado!</h2>
            <p className={styles.subtitle}>
              Você recebeu um convite para entrar em <strong>{invite.condominium_name}</strong> como{' '}
              <strong>{ROLE_LABEL[invite.invite.role] ?? invite.invite.role}</strong>.
            </p>
            <button className={styles.btnPrimary} onClick={() => setStep('auth')} style={{ marginTop: 16 }}>
              Continuar →
            </button>
          </>
        )}

        {step === 'auth' && (
          <>
            <h2 className={styles.title}>{isLogin ? 'Entre na sua conta' : 'Criar conta'}</h2>
            <p className={styles.subtitle}>para {invite?.condominium_name}</p>
            <form className={styles.form} onSubmit={handleAuth} noValidate>
              <div className={styles.field}>
                <label>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label>Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {errorMsg && <div className={styles.error}>{errorMsg}</div>}
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Aguarde…' : isLogin ? 'Entrar' : 'Criar conta'}
              </button>
            </form>
            <p className={styles.toggle}>
              {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button className={styles.link} onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Criar conta' : 'Entrar'}
              </button>
            </p>
          </>
        )}

        {step === 'accept' && (
          <>
            <h2 className={styles.title}>Complete seu perfil</h2>
            <p className={styles.subtitle}>Entrando em <strong>{invite?.condominium_name}</strong></p>
            <form className={styles.form} onSubmit={handleAccept} noValidate>
              <div className={styles.field}>
                <label>Nome completo *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva" required />
              </div>
              <div className={styles.field}>
                <label>Telefone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              {errorMsg && <div className={styles.error}>{errorMsg}</div>}
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Entrando…' : 'Aceitar convite'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <h2 className={styles.title}>Bem-vindo!</h2>
              <p className={styles.subtitle}>Você entrou em <strong>{invite?.condominium_name}</strong>. Redirecionando…</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
