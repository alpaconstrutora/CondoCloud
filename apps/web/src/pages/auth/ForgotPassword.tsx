import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './Auth.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successIcon}>✉</div>
          <h1 className={styles.title}>Verifique seu e-mail</h1>
          <p className={styles.sub}>
            Enviamos o link para redefinir a senha para <strong>{email}</strong>.
          </p>
          <Link to="/login" className={styles.btnPrimary} style={{ textAlign: 'center', display: 'block' }}>
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        <h1 className={styles.title}>Recuperar senha</h1>
        <p className={styles.sub}>Informe seu e-mail e enviaremos um link.</p>

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

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>

        <p className={styles.footer}>
          <Link to="/login">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
