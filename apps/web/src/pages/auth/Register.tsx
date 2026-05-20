import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import styles from './Auth.module.css';

interface SignupResponse {
  data: {
    access_token: string;
    refresh_token: string;
  };
}

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // Usa a API do CondoCloud que cria perfil + condomínio placeholder
      const res = await api.post<SignupResponse>('/auth/signup', { name, email, password });

      // Seta a sessão Supabase com os tokens retornados pela API
      await supabase.auth.setSession({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token,
      });

      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        <h1 className={styles.title}>Criar conta grátis</h1>
        <p className={styles.sub}>14 dias de trial sem cartão.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="name">Nome completo</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João da Silva"
            />
          </div>

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
              Senha <span className={styles.hint}>(mín. 8 caracteres)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className={styles.footer}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
