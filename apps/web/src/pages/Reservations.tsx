import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import styles from './modules.module.css';

interface CommonArea {
  id: string;
  name: string;
  capacity?: number;
}

interface Reservation {
  id: string;
  common_area_id: string;
  starts_at: string;
  ends_at: string;
  status: 'pending' | 'approved' | 'cancelled';
  notes?: string;
  common_areas?: { name: string };
}

interface ApiResponse<T> { data: T }

const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', approved: 'Aprovada', cancelled: 'Cancelada' };
const STATUS_COLOR: Record<string, string> = { pending: '#F59E0B', approved: '#16A869', cancelled: '#9ca3af' };

function CreateModal({ areas, onClose, onCreated }: { areas: CommonArea[]; onClose: () => void; onCreated: () => void }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!areaId || !startsAt || !endsAt) { setError('Preencha área, início e fim.'); return; }
    setLoading(true);
    try {
      await api.post('/reservations', { common_area_id: areaId, starts_at: startsAt, ends_at: endsAt, notes });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reservar');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Nova reserva</h2>
        {areas.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Nenhuma área comum cadastrada. Contate o síndico.</p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label>Área comum *</label>
              <select value={areaId} onChange={e => setAreaId(e.target.value)}>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Início *</label>
                <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>Fim *</label>
                <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div className={styles.field}>
              <label>Observações</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informações adicionais..." />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? 'Reservando…' : 'Solicitar reserva'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Reservations() {
  const { profile } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const isSindico = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(profile?.role ?? '');

  async function load() {
    setLoading(true);
    try {
      const [resRes, areasRes] = await Promise.all([
        api.get<ApiResponse<Reservation[]>>(isSindico ? '/reservations/all' : '/reservations'),
        api.get<ApiResponse<CommonArea[]>>('/common-areas'),
      ]);
      setReservations(resRes.data);
      setAreas(areasRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    await api.patch(`/reservations/${id}/approve`, {});
    load();
  }

  async function cancel(id: string) {
    await api.patch(`/reservations/${id}/cancel`, {});
    load();
  }

  return (
    <div className={styles.page}>
      {showCreate && (
        <CreateModal areas={areas} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Reservas</h1>
          <p className={styles.subtitle}>Reserve áreas comuns como salão de festas, churrasqueira e academia.</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nova reserva</button>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className={styles.empty}>
          <span>📅</span>
          <p>Nenhuma reserva encontrada.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Área</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Status</th>
                {isSindico && <th></th>}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.common_areas?.name ?? '—'}</td>
                  <td className={styles.tdMuted}>{new Date(r.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className={styles.tdMuted}>{new Date(r.ends_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    <span className={styles.badge} style={{ background: `${STATUS_COLOR[r.status]}20`, color: STATUS_COLOR[r.status] }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  {isSindico && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'pending' && (
                        <button className={`${styles.btnSmall} ${styles.btnSmallGreen}`} onClick={() => approve(r.id)}>Aprovar</button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button className={`${styles.btnSmall} ${styles.btnSmallRed}`} onClick={() => cancel(r.id)}>Cancelar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
