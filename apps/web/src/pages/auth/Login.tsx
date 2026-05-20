import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Auth.module.css';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rawFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const from = rawFrom && rawFrom !== '/' ? rawFrom : '/dashboard';

  if (session) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : authError.message);
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        <h1 className={styles.title}>Entrar na sua conta</h1>
        <p className={styles.sub}>Bem-vindo de volta, síndico.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">
              Senha
              <Link to="/forgot-password" className={styles.forgotLink}>Esqueceu?</Link>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className={styles.footer}>
          Não tem conta?{' '}
          <Link to="/register">Criar conta grátis</Link>
        </p>
      </div>
    </div>
  );
}
