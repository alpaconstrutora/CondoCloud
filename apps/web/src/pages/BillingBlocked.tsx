import { useAuth } from '../contexts/AuthContext';

export default function BillingBlocked() {
  const { signOut, activeCondominium } = useAuth();

  const isCanceled =
    activeCondominium?.subscription_status === 'canceled' ||
    activeCondominium?.subscription_status === 'paused';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #f6f8fa)',
        fontFamily: 'var(--sans, sans-serif)',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
          padding: '40px 36px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#111',
            marginBottom: 12,
          }}
        >
          {isCanceled ? 'Assinatura cancelada' : 'Acesso temporariamente bloqueado'}
        </h1>
        <p style={{ color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
          {isCanceled
            ? 'Sua assinatura foi cancelada. Para reativar o CondoCloud e continuar gerenciando seu condomínio, entre em contato com o suporte.'
            : 'Seu pagamento está pendente há mais de 30 dias. Regularize sua assinatura para voltar a ter acesso completo ao CondoCloud.'}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <a
            href="mailto:suporte@condocloud.com.br"
            style={{
              display: 'block',
              background: 'var(--accent, #16A869)',
              color: '#fff',
              borderRadius: 10,
              padding: '13px 0',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            📧 Falar com o suporte
          </a>

          <button
            onClick={signOut}
            style={{
              background: 'none',
              border: '1.5px solid #ddd',
              borderRadius: 10,
              padding: '12px 0',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: '#555',
              cursor: 'pointer',
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
