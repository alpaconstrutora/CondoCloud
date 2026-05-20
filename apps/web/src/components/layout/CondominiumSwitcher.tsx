import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './CondominiumSwitcher.module.css';

export default function CondominiumSwitcher() {
  const { myCondominiums, activeCondominiumId, switchCondominium } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = myCondominiums.find((c) => c.id === activeCondominiumId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (myCondominiums.length === 0) return null;

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen((o) => !o)} title="Trocar condomínio">
        <span className={styles.icon}>🏢</span>
        <span className={styles.name}>{active?.name ?? 'Selecionar'}</span>
        <span className={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>Condomínios</div>
          {myCondominiums.map((condo) => (
            <button
              key={condo.id}
              className={`${styles.item} ${condo.id === activeCondominiumId ? styles.active : ''}`}
              onClick={() => { switchCondominium(condo.id); setOpen(false); window.location.reload(); }}
            >
              <span className={styles.itemIcon}>🏢</span>
              <span className={styles.itemName}>{condo.name}</span>
              {condo.id === activeCondominiumId && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
