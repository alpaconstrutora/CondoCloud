import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import styles from './Auth.module.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        <h1 className={styles.title}>Nova senha</h1>
        <p className={styles.sub}>Escolha uma senha segura para sua conta.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="password">Nova senha <span className={styles.hint}>(mín. 8 caracteres)</span></label>
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
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
