import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './Onboarding.module.css';

const STEPS = [
  { n: 1, label: 'Condomínio' },
  { n: 2, label: 'Estrutura' },
  { n: 3, label: 'Convite' },
  { n: 4, label: 'Configurações' },
  { n: 5, label: 'Concluir' },
];

/* ──────────── Step 1 ──────────── */
function Step1({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nome do condomínio é obrigatório.'); return; }
    setLoading(true);
    try {
      await api.patch('/onboarding/step/1', { name, address, cnpj });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.stepTitle}>Dados do condomínio</h2>
      <p className={styles.stepDesc}>Vamos começar com as informações básicas. Você pode editar depois.</p>

      <div className={styles.field}>
        <label htmlFor="name">Nome do condomínio *</label>
        <input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Residencial das Flores" required />
      </div>
      <div className={styles.field}>
        <label htmlFor="address">Endereço</label>
        <input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua das Acácias, 123 — São Paulo, SP" />
      </div>
      <div className={styles.field}>
        <label htmlFor="cnpj">CNPJ <span className={styles.optional}>(opcional)</span></label>
        <input id="cnpj" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.btnPrimary} disabled={loading}>
        {loading ? 'Salvando…' : 'Continuar →'}
      </button>
    </form>
  );
}

/* ──────────── Step 2 ──────────── */
function Step2({ onNext }: { onNext: () => void }) {
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick');
  const [totalUnits, setTotalUnits] = useState(20);
  const [blocks, setBlocks] = useState([{ name: 'Bloco A', units_count: 20 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addBlock() {
    setBlocks(b => [...b, { name: `Bloco ${String.fromCharCode(65 + b.length)}`, units_count: 10 }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/onboarding/step/2', mode === 'quick' ? { mode, total_units: totalUnits } : { mode, blocks });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar estrutura');
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.stepTitle}>Estrutura do condomínio</h2>
      <p className={styles.stepDesc}>Defina blocos e unidades. As unidades são geradas automaticamente.</p>

      <div className={styles.modeSwitch}>
        <button type="button" className={mode === 'quick' ? styles.modeActive : styles.modeBtn} onClick={() => setMode('quick')}>Rápido</button>
        <button type="button" className={mode === 'detailed' ? styles.modeActive : styles.modeBtn} onClick={() => setMode('detailed')}>Detalhado</button>
      </div>

      {mode === 'quick' ? (
        <div className={styles.field}>
          <label htmlFor="units">Total de unidades</label>
          <input id="units" type="number" min={1} max={500} value={totalUnits}
            onChange={e => setTotalUnits(Number(e.target.value))} />
          <span className={styles.hint}>Um único bloco será criado com {totalUnits} unidades.</span>
        </div>
      ) : (
        <div className={styles.blockList}>
          {blocks.map((b, i) => (
            <div key={i} className={styles.blockRow}>
              <input value={b.name} onChange={e => setBlocks(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                placeholder="Nome do bloco" className={styles.blockName} />
              <input type="number" min={1} max={200} value={b.units_count}
                onChange={e => setBlocks(prev => prev.map((x, j) => j === i ? { ...x, units_count: Number(e.target.value) } : x))}
                className={styles.blockUnits} />
              <span className={styles.blockLabel}>unidades</span>
              {blocks.length > 1 && (
                <button type="button" onClick={() => setBlocks(b => b.filter((_, j) => j !== i))} className={styles.removeBtn}>×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addBlock} className={styles.addBtn}>+ Adicionar bloco</button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      <button type="submit" className={styles.btnPrimary} disabled={loading}>
        {loading ? 'Criando estrutura…' : 'Continuar →'}
      </button>
    </form>
  );
}

/* ──────────── Step 3 ──────────── */
function Step3({ onNext }: { onNext: () => void }) {
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateLink() {
    setLoading(true);
    try {
      const res = await api.post<{ data: { invite_url: string } }>('/onboarding/step/3/invite');
      setInviteUrl(res.data.invite_url);
    } catch {
      setInviteUrl('');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.form}>
      <h2 className={styles.stepTitle}>Convide seus moradores</h2>
      <p className={styles.stepDesc}>Gere um link de convite para compartilhar via WhatsApp ou e-mail. Você pode gerar mais links depois.</p>

      {!inviteUrl ? (
        <button type="button" className={styles.btnPrimary} onClick={generateLink} disabled={loading}>
          {loading ? 'Gerando link…' : '🔗 Gerar link de convite'}
        </button>
      ) : (
        <div className={styles.inviteBox}>
          <div className={styles.inviteUrl}>{inviteUrl}</div>
          <button type="button" onClick={copyLink} className={styles.btnCopy}>
            {copied ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>
      )}

      <button type="button" className={styles.btnSecondary} onClick={onNext}>
        {inviteUrl ? 'Continuar →' : 'Pular por agora →'}
      </button>
    </div>
  );
}

/* ──────────── Step 4 ──────────── */
function Step4({ onNext }: { onNext: () => void }) {
  const [slaMaint, setSlaMaint] = useState(72);
  const [slaUrgent, setSlaUrgent] = useState(4);
  const [taxa, setTaxa] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/onboarding/step/4', {
        sla_manutencao_hours: slaMaint,
        sla_urgente_hours: slaUrgent,
        taxa_condominial: taxa ? Number(taxa) : undefined,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.stepTitle}>Configurações iniciais</h2>
      <p className={styles.stepDesc}>Valores padrão para SLA de chamados e taxa condominial.</p>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="sla-maint">SLA manutenção (horas)</label>
          <input id="sla-maint" type="number" min={1} value={slaMaint} onChange={e => setSlaMaint(Number(e.target.value))} />
        </div>
        <div className={styles.field}>
          <label htmlFor="sla-urgent">SLA urgente (horas)</label>
          <input id="sla-urgent" type="number" min={1} value={slaUrgent} onChange={e => setSlaUrgent(Number(e.target.value))} />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="taxa">Taxa condominial base (R$) <span className={styles.optional}>(opcional)</span></label>
        <input id="taxa" type="number" min={0} step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="850,00" />
      </div>

      {error && <div className={styles.error}>{error}</div>}
      <button type="submit" className={styles.btnPrimary} disabled={loading}>
        {loading ? 'Salvando…' : 'Continuar →'}
      </button>
    </form>
  );
}

/* ──────────── Step 5 ──────────── */
function Step5({ onComplete }: { onComplete: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    setLoading(true);
    await onComplete();
  }

  return (
    <div className={styles.form} style={{ textAlign: 'center' }}>
      <div className={styles.successIcon}>🎉</div>
      <h2 className={styles.stepTitle}>Tudo pronto!</h2>
      <p className={styles.stepDesc}>
        Seu condomínio está configurado. Você já pode usar o CondoCloud para gerenciar chamados,
        finanças, assembleias e muito mais.
      </p>
      <button type="button" className={styles.btnPrimary} onClick={handleComplete} disabled={loading}>
        {loading ? 'Finalizando…' : 'Ir para o painel →'}
      </button>
    </div>
  );
}

/* ──────────── Main ──────────── */
export default function Onboarding() {
  const [step, setStep] = useState(1);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  function next() { setStep(s => s + 1); }

  async function complete() {
    await api.post('/onboarding/step/5/complete');
    await refreshProfile();
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoMark}>CC</div>
          <span>CondoCloud</span>
        </div>

        {/* Progress */}
        <div className={styles.progress}>
          {STEPS.map(s => (
            <div key={s.n} className={styles.progressItem}>
              <div className={`${styles.progressDot} ${step > s.n ? styles.dotDone : step === s.n ? styles.dotActive : ''}`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className={`${styles.progressLabel} ${step === s.n ? styles.labelActive : ''}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className={styles.content}>
          {step === 1 && <Step1 onNext={next} />}
          {step === 2 && <Step2 onNext={next} />}
          {step === 3 && <Step3 onNext={next} />}
          {step === 4 && <Step4 onNext={next} />}
          {step === 5 && <Step5 onComplete={complete} />}
        </div>
      </div>
    </div>
  );
}
