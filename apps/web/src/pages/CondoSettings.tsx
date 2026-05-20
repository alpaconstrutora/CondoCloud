import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import styles from './modules.module.css';
import cs from './CondoSettings.module.css';

interface Vendor {
  id: string;
  company_name?: string;
  specialty: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  active: boolean;
  is_default: boolean;
  vendor_id: string | null;
  vendors?: Vendor | null;
}

interface Recurring {
  id: string;
  description: string;
  category: string;
  amount: number;
  day_of_month: number;
  active: boolean;
  last_generated: string | null;
}

interface Block {
  id: string;
  name: string;
  units: { count: number }[];
}

interface Unit {
  id: string;
  number: string;
  block_id: string;
  floor?: number;
  size_sqm?: number;
  parking_spots?: number;
  blocks?: { id: string; name: string };
  unit_profiles?: { profile_id: string; is_responsible: boolean; profiles: { id: string; name: string } | null }[];
}

interface Profile {
  id: string;
  name: string;
  role: string;
  unit_id: string | null;
}

interface Condo {
  id: string;
  name: string;
  cnpj?: string;
  address?: string;
  settings?: {
    phone?: string;
    email?: string;
    manager_name?: string;
    address_street?: string;
    address_number?: string;
    address_bairro?: string;
    address_city?: string;
    address_state?: string;
    sla_manutencao_hours?: number;
    sla_urgente_hours?: number;
    taxa_condominial?: number;
  };
  blocks: Block[];
  total_units: number;
}

interface ApiResp<T> { data: T }

function UnitModal({ unit, blocks, profiles, onClose, onSaved }: {
  unit?: Unit;
  blocks: Block[];
  profiles: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(unit?.number ?? '');
  const [blockId, setBlockId] = useState(unit?.block_id ?? '');
  const [floor, setFloor] = useState(unit?.floor?.toString() ?? '');
  const [size, setSize] = useState(unit?.size_sqm?.toString() ?? '');
  const [parking, setParking] = useState(unit?.parking_spots?.toString() ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(
      (unit?.unit_profiles ?? [])
        .map(up => up.profiles?.id)
        .filter(Boolean) as string[]
    )
  );
  const [responsibleId, setResponsibleId] = useState<string | null>(
    () => (unit?.unit_profiles ?? []).find(up => up.is_responsible)?.profile_id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleResident(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear responsible if this morador is being removed
        if (responsibleId === id) setResponsibleId(null);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = {
        number: number || undefined,
        block_id: blockId || undefined,
        floor: floor ? Number(floor) : undefined,
        size_sqm: size ? Number(size) : undefined,
        parking_spots: parking ? Number(parking) : undefined,
      };
      let unitId: string;
      if (unit?.id) {
        await api.patch(`/condominium/units/${unit.id}`, payload);
        unitId = unit.id;
      } else {
        const res = await api.post<ApiResp<{ id: string }>>('/condominium/units', payload);
        unitId = res.data.id;
      }

      const prevIds = new Set(
        (unit?.unit_profiles ?? []).map(up => up.profiles?.id).filter(Boolean) as string[]
      );
      const toAdd = [...selectedIds].filter(id => !prevIds.has(id));
      const toRemove = [...prevIds].filter(id => !selectedIds.has(id));

      await Promise.all([
        ...toAdd.map(pid => api.post(`/condominium/units/${unitId}/residents`, { profile_id: pid }).catch(() => {})),
        ...toRemove.map(pid => api.delete(`/condominium/units/${unitId}/residents/${pid}`).catch(() => {})),
      ]);

      // Set responsible resident if one is selected
      const prevResponsible = (unit?.unit_profiles ?? []).find(up => up.is_responsible)?.profile_id ?? null;
      if (responsibleId && responsibleId !== prevResponsible) {
        await api.patch(`/condominium/units/${unitId}/residents/${responsibleId}/responsible`, {}).catch(() => {});
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{unit ? 'Editar unidade' : 'Nova unidade'}</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Bloco *</label>
              <select value={blockId} onChange={e => setBlockId(e.target.value)} required>
                <option value="">Selecione</option>
                {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Número *</label>
              <input value={number} onChange={e => setNumber(e.target.value)} placeholder="101" required />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Pavimento</label>
              <input type="number" value={floor} onChange={e => setFloor(e.target.value)} placeholder="1" min="0" />
            </div>
            <div className={styles.field}>
              <label>Tamanho (m²)</label>
              <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="85" min="0" step="0.01" />
            </div>
            <div className={styles.field}>
              <label>Vagas</label>
              <input type="number" value={parking} onChange={e => setParking(e.target.value)} placeholder="2" min="0" />
            </div>
          </div>
          {profiles.length > 0 && (
            <div className={styles.field}>
              <label>Moradores</label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxHeight: 200, overflowY: 'auto', padding: '6px 10px' }}>
                {profiles.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  const isResp = responsibleId === p.id;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleResident(p.id)}
                        style={{ accentColor: 'var(--green)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, fontSize: '0.88rem', opacity: isSelected ? 1 : 0.45 }}>{p.name}</span>
                      {isSelected && (
                        <button
                          type="button"
                          title={isResp ? 'Responsável financeiro' : 'Marcar como responsável financeiro'}
                          onClick={() => setResponsibleId(isResp ? null : p.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1rem', lineHeight: 1, padding: '0 2px',
                            color: isResp ? '#e6a817' : 'var(--text-muted)',
                            opacity: isResp ? 1 : 0.4,
                          }}
                        >
                          ★
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedIds.size > 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  ★ = responsável financeiro (para geração de cobranças por morador)
                </p>
              )}
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CondoSettings() {
  const [condo, setCondo] = useState<Condo | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'blocks' | 'units' | 'settings' | 'categories'>('general');

  // Dados gerais
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [managerName, setManagerName] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [bairro, setBairro] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saving1, setSaving1] = useState(false);
  const [msg1, setMsg1] = useState('');

  // Configurações operacionais
  const [slaManut, setSlaManut] = useState('');
  const [slaUrg, setSlaUrg] = useState('');
  const [taxa, setTaxa] = useState('');
  const [saving2, setSaving2] = useState(false);
  const [msg2, setMsg2] = useState('');

  // Categories
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'income' | 'expense'>('expense');
  const [catFilter, setCatFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');
  const [editCat, setEditCat] = useState<FinancialCategory | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catIsFixed, setCatIsFixed] = useState(false);
  const [catFixedAmount, setCatFixedAmount] = useState('');
  const [catFixedDay, setCatFixedDay] = useState('');
  const [catVendorId, setCatVendorId] = useState('');

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Recurring expenses
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);
  const [recDescription, setRecDescription] = useState('');
  const [recCategory, setRecCategory] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState('');
  const [recSaving, setRecSaving] = useState(false);
  const [recError, setRecError] = useState('');

  // Profiles (for resident linking)
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Units modal
  const [editUnit, setEditUnit] = useState<Unit | undefined>();
  const [showUnitModal, setShowUnitModal] = useState(false);

  // Blocks modal
  const [editBlock, setEditBlock] = useState<Block | undefined>();
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState('');

  async function loadCategories() {
    const res = await api.get<ApiResp<FinancialCategory[]>>('/financial/categories').catch(() => ({ data: [] as FinancialCategory[] }));
    setCategories(res.data ?? []);
  }

  async function loadVendors() {
    const res = await api.get<ApiResp<Vendor[]>>('/vendors').catch(() => ({ data: [] as Vendor[] }));
    setVendors(res.data ?? []);
  }

  async function loadRecurring() {
    setRecurringLoading(true);
    try {
      const res = await api.get<ApiResp<Recurring[]>>('/financial/recurring');
      setRecurring(res.data ?? []);
    } catch {
      setRecurring([]);
    } finally {
      setRecurringLoading(false);
    }
  }

  function openRecModal() {
    setRecDescription('');
    setRecCategory(categories.find(c => c.type === 'expense')?.name ?? '');
    setRecAmount('');
    setRecDay('');
    setRecError('');
    setShowRecModal(true);
  }

  async function saveRec(e: FormEvent) {
    e.preventDefault();
    if (!recDescription.trim() || !recAmount || !recDay) { setRecError('Preencha todos os campos obrigatórios.'); return; }
    const day = Number(recDay);
    if (day < 1 || day > 28) { setRecError('Dia do mês deve ser entre 1 e 28.'); return; }
    setRecSaving(true); setRecError('');
    try {
      await api.post('/financial/recurring', {
        description: recDescription.trim(),
        category: recCategory,
        amount: Number(recAmount),
        day_of_month: day,
      });
      setShowRecModal(false);
      loadRecurring();
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Erro ao salvar');
      setRecSaving(false);
    }
  }

  async function toggleRecurring(r: Recurring) {
    await api.patch(`/financial/recurring/${r.id}`, { active: !r.active });
    loadRecurring();
  }

  async function deleteRecurring(r: Recurring) {
    if (!confirm(`Remover despesa fixa "${r.description}"? Os lançamentos já gerados não serão afetados.`)) return;
    await api.delete(`/financial/recurring/${r.id}`);
    loadRecurring();
  }

  async function load() {
    setLoading(true);
    try {
      const [condoRes, unitsRes, blocksRes, profilesRes] = await Promise.all([
        api.get<ApiResp<Condo>>('/condominium'),
        api.get<ApiResp<Unit[]>>('/condominium/units'),
        api.get<ApiResp<Block[]>>('/condominium/blocks'),
        api.get<ApiResp<Profile[]>>('/auth/profiles').catch(() => ({ data: [] as Profile[] })),
      ]);
      const c = condoRes.data;
      setCondo(c);
      setUnits(unitsRes.data ?? []);
      setBlocks(blocksRes.data ?? []);
      setProfiles(profilesRes.data ?? []);
      setName(c.name ?? '');
      setCnpj(c.cnpj ?? '');
      setPhone(c.settings?.phone ?? '');
      setEmail(c.settings?.email ?? '');
      setManagerName(c.settings?.manager_name ?? '');
      setStreet(c.settings?.address_street ?? '');
      setNumber(c.settings?.address_number ?? '');
      setBairro(c.settings?.address_bairro ?? '');
      setCity(c.settings?.address_city ?? '');
      setState(c.settings?.address_state ?? '');
      setSlaManut(c.settings?.sla_manutencao_hours?.toString() ?? '');
      setSlaUrg(c.settings?.sla_urgente_hours?.toString() ?? '');
      setTaxa(c.settings?.taxa_condominial?.toString() ?? '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadCategories(); loadRecurring(); loadVendors(); }, []);

  async function saveBasic(e: FormEvent) {
    e.preventDefault();
    setSaving1(true); setMsg1('');
    try {
      const parts = [street, number ? `nº ${number}` : '', bairro, city, state].filter(Boolean);
      const fullAddress = parts.join(', ') || undefined;
      await api.patch('/condominium', {
        name: name || undefined,
        cnpj: cnpj || undefined,
        address: fullAddress,
        phone: phone || undefined,
        email: email || undefined,
        manager_name: managerName || undefined,
        address_street: street || undefined,
        address_number: number || undefined,
        address_bairro: bairro || undefined,
        address_city: city || undefined,
        address_state: state || undefined,
      });
      setMsg1('Salvo!');
      setTimeout(() => setMsg1(''), 2500);
    } catch (err) {
      setMsg1(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving1(false);
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSaving2(true); setMsg2('');
    try {
      await api.patch('/condominium', {
        sla_manutencao_hours: slaManut ? Number(slaManut) : undefined,
        sla_urgente_hours: slaUrg ? Number(slaUrg) : undefined,
        taxa_condominial: taxa ? Number(taxa) : undefined,
      });
      setMsg2('Salvo!');
      setTimeout(() => setMsg2(''), 2500);
    } catch (err) {
      setMsg2(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving2(false);
    }
  }

  async function handleDeleteUnit(id: string) {
    if (!confirm('Remover esta unidade?')) return;
    try {
      await api.delete(`/condominium/units/${id}`);
      setUnits(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  function openBlockModal(block?: Block) {
    setEditBlock(block);
    setBlockName(block?.name ?? '');
    setBlockError('');
    setShowBlockModal(true);
  }

  async function saveBlock(e: FormEvent) {
    e.preventDefault();
    setBlockSaving(true); setBlockError('');
    try {
      if (editBlock) {
        await api.patch(`/condominium/blocks/${editBlock.id}`, { name: blockName });
      } else {
        await api.post('/condominium/blocks', { name: blockName });
      }
      setShowBlockModal(false);
      load();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : 'Erro ao salvar');
      setBlockSaving(false);
    }
  }

  function openCatModal(cat?: FinancialCategory) {
    setEditCat(cat ?? null);
    setCatName(cat?.name ?? '');
    setCatType(cat?.type ?? 'expense');
    setCatError('');
    setCatVendorId(cat?.vendor_id ?? '');
    // Pre-populate recurring fields if this category already has a recurring entry
    const existingRec = cat ? recurring.find(r => r.category === cat.name) : undefined;
    setCatIsFixed(!!existingRec);
    setCatFixedAmount(existingRec ? String(existingRec.amount) : '');
    setCatFixedDay(existingRec ? String(existingRec.day_of_month) : '');
    setShowCatModal(true);
  }

  async function saveCat(e: FormEvent) {
    e.preventDefault();
    if (!catName.trim()) { setCatError('Nome é obrigatório'); return; }
    if (catIsFixed && catType === 'expense') {
      const day = Number(catFixedDay);
      if (!catFixedDay) { setCatError('Informe o dia do mês para a despesa fixa.'); return; }
      if (day < 1 || day > 28) { setCatError('Dia do mês deve ser entre 1 e 28.'); return; }
    }
    setCatSaving(true); setCatError('');
    try {
      const savedName = catName.trim();
      if (editCat) {
        await api.patch(`/financial/categories/${editCat.id}`, { name: savedName, vendor_id: catVendorId || null });
      } else {
        await api.post('/financial/categories', { name: savedName, type: catType, vendor_id: catVendorId || undefined });
      }
      setShowCatModal(false);
      loadCategories();

      // Create or update recurring entry — runs after modal closes so errors are visible
      if (catIsFixed && catType === 'expense') {
        try {
          const existingRec = recurring.find(r => r.category === (editCat?.name ?? savedName));
          if (existingRec) {
            await api.patch(`/financial/recurring/${existingRec.id}`, {
              description: savedName,
              category: savedName,
              amount: catFixedAmount ? Number(catFixedAmount) : 0,
              day_of_month: Number(catFixedDay),
              active: true,
            });
          } else {
            await api.post('/financial/recurring', {
              description: savedName,
              category: savedName,
              amount: catFixedAmount ? Number(catFixedAmount) : 0,
              day_of_month: Number(catFixedDay),
            });
          }
          loadRecurring();
        } catch (recErr) {
          alert(`Categoria salva, mas erro ao configurar despesa fixa: ${recErr instanceof Error ? recErr.message : 'Erro desconhecido'}. Tente editar a categoria novamente.`);
        }
      }
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Erro ao salvar');
      setCatSaving(false);
    }
  }

  async function toggleCatActive(cat: FinancialCategory) {
    try {
      await api.patch(`/financial/categories/${cat.id}`, { active: !cat.active });
      loadCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  async function deleteCat(cat: FinancialCategory) {
    if (cat.is_default) { alert('Categorias padrão não podem ser removidas, apenas desativadas.'); return; }
    if (!confirm(`Remover categoria "${cat.name}"?`)) return;
    try {
      await api.delete(`/financial/categories/${cat.id}`);
      loadCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  async function handleDeleteBlock(id: string) {
    if (!confirm('Remover este bloco? Todas as unidades vinculadas serão desassociadas.')) return;
    try {
      await api.delete(`/condominium/blocks/${id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Configurações do Condomínio</h1>
          <p className={styles.subtitle}>Gerencie dados, estrutura e operações.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.filters}>
        <button className={`${styles.filterBtn} ${activeTab === 'general' ? styles.filterActive : ''}`} onClick={() => setActiveTab('general')}>
          Dados Gerais
        </button>
        <button className={`${styles.filterBtn} ${activeTab === 'blocks' ? styles.filterActive : ''}`} onClick={() => setActiveTab('blocks')}>
          Blocos ({blocks.length})
        </button>
        <button className={`${styles.filterBtn} ${activeTab === 'units' ? styles.filterActive : ''}`} onClick={() => setActiveTab('units')}>
          Unidades ({units.length})
        </button>
        <button className={`${styles.filterBtn} ${activeTab === 'settings' ? styles.filterActive : ''}`} onClick={() => setActiveTab('settings')}>
          Operacional
        </button>
        <button className={`${styles.filterBtn} ${activeTab === 'categories' ? styles.filterActive : ''}`} onClick={() => setActiveTab('categories')}>
          Categorias Financeiras
        </button>
      </div>

      {/* GENERAL TAB */}
      {activeTab === 'general' && (
        <>
          <section className={cs.card}>
            <h2 className={cs.sectionTitle}>Dados do Condomínio</h2>
            <form onSubmit={saveBasic}>
              <div className={cs.grid2}>
                <div className={styles.field}>
                  <label>Nome do condomínio *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Condomínio Parque Verde" required />
                </div>
                <div className={styles.field}>
                  <label>CNPJ</label>
                  <input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
              </div>

              <div className={cs.sectionSubtitle}>Endereço</div>
              <div className={cs.grid31}>
                <div className={styles.field}>
                  <label>Logradouro</label>
                  <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua das Flores" />
                </div>
                <div className={styles.field}>
                  <label>Número</label>
                  <input value={number} onChange={e => setNumber(e.target.value)} placeholder="100" />
                </div>
              </div>
              <div className={cs.grid3}>
                <div className={styles.field}>
                  <label>Bairro</label>
                  <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Jardim América" />
                </div>
                <div className={styles.field}>
                  <label>Cidade</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo" />
                </div>
                <div className={styles.field}>
                  <label>Estado</label>
                  <select value={state} onChange={e => setState(e.target.value)}>
                    <option value="">Selecione</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={cs.sectionSubtitle}>Contato</div>
              <div className={cs.grid2}>
                <div className={styles.field}>
                  <label>Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 3333-4444" />
                </div>
                <div className={styles.field}>
                  <label>E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@condoparqueverde.com" />
                </div>
              </div>
              <div className={cs.grid1}>
                <div className={styles.field}>
                  <label>Síndico / Administradora</label>
                  <input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="João Silva / Administradora XYZ" />
                </div>
              </div>

              <div className={cs.formFooter}>
                {msg1 && <span className={msg1 === 'Salvo!' ? cs.msgOk : cs.msgErr}>{msg1}</span>}
                <button type="submit" className={styles.btnPrimary} disabled={saving1}>
                  {saving1 ? 'Salvando…' : 'Salvar dados'}
                </button>
              </div>
            </form>
          </section>

          <section className={cs.card}>
            <h2 className={cs.sectionTitle}>Estrutura</h2>
            <div className={cs.statsRow}>
              <div className={cs.statBox}>
                <span className={cs.statVal}>{condo?.blocks.length ?? 0}</span>
                <span className={cs.statLbl}>Blocos</span>
              </div>
              <div className={cs.statBox}>
                <span className={cs.statVal}>{condo?.total_units ?? 0}</span>
                <span className={cs.statLbl}>Unidades</span>
              </div>
            </div>
            <p className={cs.structureNote}>
              Para gerenciar unidades individualmente, acesse a aba "Unidades".
            </p>
          </section>
        </>
      )}

      {/* BLOCKS TAB */}
      {activeTab === 'blocks' && (
        <section className={cs.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className={cs.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>Blocos</h2>
            <button className={styles.btnPrimary} onClick={() => openBlockModal()}>+ Bloco</button>
          </div>

          {showBlockModal && (
            <div className={styles.overlay} onClick={() => setShowBlockModal(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 className={styles.modalTitle}>{editBlock ? 'Editar bloco' : 'Novo bloco'}</h2>
                <form className={styles.form} onSubmit={saveBlock} noValidate>
                  <div className={styles.field}>
                    <label>Nome *</label>
                    <input value={blockName} onChange={e => setBlockName(e.target.value)} placeholder="Bloco A" required autoFocus />
                  </div>
                  {blockError && <div className={styles.error}>{blockError}</div>}
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setShowBlockModal(false)}>Cancelar</button>
                    <button type="submit" className={styles.btnPrimary} disabled={blockSaving}>
                      {blockSaving ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {blocks.length === 0 ? (
            <div className={styles.empty}><span>🏢</span><p>Nenhum bloco cadastrado.</p></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Unidades</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.name}</td>
                      <td className={styles.tdMuted}>{b.units?.[0]?.count ?? 0}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className={styles.iconBtn} title="Editar" onClick={() => openBlockModal(b)}>✏️</button>
                        <button className={styles.iconBtn} title="Remover" onClick={() => handleDeleteBlock(b.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* UNITS TAB */}
      {activeTab === 'units' && (
        <section className={cs.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className={cs.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>Unidades</h2>
            <button className={styles.btnPrimary} onClick={() => { setEditUnit(undefined); setShowUnitModal(true); }}>+ Unidade</button>
          </div>

          {showUnitModal && (
            <UnitModal
              unit={editUnit}
              blocks={blocks}
              profiles={profiles}
              onClose={() => { setShowUnitModal(false); setEditUnit(undefined); }}
              onSaved={() => { setShowUnitModal(false); setEditUnit(undefined); load(); }}
            />
          )}

          {units.length === 0 ? (
            <div className={styles.empty}><span>🏠</span><p>Nenhuma unidade cadastrada.</p></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Bloco</th>
                    <th>Pavimento</th>
                    <th>Tamanho (m²)</th>
                    <th>Vagas</th>
                    <th>Morador</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(u => {
                    const profiles = u.unit_profiles ?? [];
                    const responsible = profiles.find(up => up.is_responsible);
                    const others = profiles.filter(up => !up.is_responsible).map(up => up.profiles?.name).filter(Boolean);
                    const residentDisplay = profiles.length === 0 ? '—' : (
                      <>
                        {responsible?.profiles?.name && (
                          <span title="Responsável financeiro" style={{ color: '#e6a817', marginRight: 2 }}>★</span>
                        )}
                        {[responsible?.profiles?.name, ...others].filter(Boolean).join(', ')}
                      </>
                    );
                    return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.number}</td>
                      <td className={styles.tdMuted}>{u.blocks?.name ?? '—'}</td>
                      <td className={styles.tdMuted}>{u.floor ?? '—'}</td>
                      <td className={styles.tdMuted}>{u.size_sqm ? `${u.size_sqm.toFixed(1)} m²` : '—'}</td>
                      <td className={styles.tdMuted}>{u.parking_spots ?? '—'}</td>
                      <td className={styles.tdMuted}>{residentDisplay}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className={styles.iconBtn} title="Editar" onClick={() => { setEditUnit(u); setShowUnitModal(true); }}>✏️</button>
                        <button className={styles.iconBtn} title="Remover" onClick={() => handleDeleteUnit(u.id)}>🗑️</button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <section className={cs.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className={cs.sectionTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>Categorias Financeiras</h2>
            <button className={styles.btnPrimary} onClick={() => openCatModal()}>+ Categoria</button>
          </div>

          {/* Modal */}
          {showCatModal && (
            <div className={styles.overlay} onClick={() => setShowCatModal(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 className={styles.modalTitle}>{editCat ? 'Editar categoria' : 'Nova categoria'}</h2>
                <form className={styles.form} onSubmit={saveCat} noValidate>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Tipo</label>
                      <select value={catType} onChange={e => { setCatType(e.target.value as 'income' | 'expense'); if (e.target.value === 'income') setCatIsFixed(false); }} disabled={!!editCat}>
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Nome *</label>
                      <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Jardinagem" required autoFocus />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label>Fornecedor</label>
                    <select value={catVendorId} onChange={e => setCatVendorId(e.target.value)}>
                      <option value="">— Nenhum —</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.company_name ?? v.specialty}</option>
                      ))}
                    </select>
                  </div>

                  {catType === 'expense' && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={catIsFixed}
                          onChange={e => setCatIsFixed(e.target.checked)}
                          style={{ marginTop: 3, accentColor: 'var(--green)', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Despesa Fixa</span>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            Lançamento gerado automaticamente todo mês na data configurada.
                          </p>
                        </div>
                      </label>

                      {catIsFixed && (
                        <div className={styles.fieldRow} style={{ marginTop: 14 }}>
                          <div className={styles.field}>
                            <label>Valor estimado (R$)</label>
                            <input type="number" min="0" step="0.01" value={catFixedAmount} onChange={e => setCatFixedAmount(e.target.value)} placeholder="0,00" />
                          </div>
                          <div className={styles.field}>
                            <label>Dia do mês *</label>
                            <input type="number" min="1" max="28" value={catFixedDay} onChange={e => setCatFixedDay(e.target.value)} placeholder="5" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {catError && <div className={styles.error}>{catError}</div>}
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setShowCatModal(false)}>Cancelar</button>
                    <button type="submit" className={styles.btnPrimary} disabled={catSaving}>
                      {catSaving ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Filtro */}
          <div className={styles.filters} style={{ marginBottom: 16 }}>
            {([['all', 'Todas'], ['income', 'Receitas'], ['expense', 'Despesas']] as const).map(([v, l]) => (
              <button key={v} className={`${styles.filterBtn} ${catFilter === v ? styles.filterActive : ''}`} onClick={() => setCatFilter(v)}>{l}</button>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Fornecedor</th>
                  <th>Padrão</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories
                  .filter(c => catFilter === 'all' || c.type === catFilter)
                  .map(c => (
                    <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <span className={styles.badge} style={{
                          background: c.type === 'income' ? '#dcfce7' : '#fee2e2',
                          color: c.type === 'income' ? '#15803d' : '#b91c1c',
                        }}>
                          {c.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={styles.tdMuted}>{c.vendors?.company_name ?? '—'}</td>
                      <td className={styles.tdMuted}>{c.is_default ? 'Sim' : 'Não'}</td>
                      <td>
                        <span className={styles.badge} style={{
                          background: c.active ? '#dcfce7' : '#f3f4f6',
                          color: c.active ? '#15803d' : '#6b7280',
                        }}>
                          {c.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className={styles.iconBtn} title="Editar nome" onClick={() => openCatModal(c)}>✏️</button>
                        <button className={styles.iconBtn} title={c.active ? 'Desativar' : 'Ativar'} onClick={() => toggleCatActive(c)}>
                          {c.active ? '🔕' : '🔔'}
                        </button>
                        {!c.is_default && (
                          <button className={styles.iconBtn} title="Remover" onClick={() => deleteCat(c)}>🗑️</button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {categories.filter(c => catFilter === 'all' || c.type === catFilter).length === 0 && (
              <div className={styles.empty}><span>🏷️</span><p>Nenhuma categoria encontrada.</p></div>
            )}
          </div>

          {/* Despesas Fixas */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0 16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Despesas Fixas</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Lançamentos gerados automaticamente todo mês na data configurada.
              </p>
            </div>
            <button className={styles.btnPrimary} onClick={openRecModal}>+ Despesa Fixa</button>
          </div>

          {showRecModal && (
            <div className={styles.overlay} onClick={() => setShowRecModal(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2 className={styles.modalTitle}>Nova Despesa Fixa</h2>
                <form className={styles.form} onSubmit={saveRec} noValidate>
                  <div className={styles.field}>
                    <label>Descrição *</label>
                    <input value={recDescription} onChange={e => setRecDescription(e.target.value)} placeholder="Ex: Manutenção elevador" autoFocus />
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label>Categoria</label>
                      <select value={recCategory} onChange={e => setRecCategory(e.target.value)}>
                        {categories.filter(c => c.type === 'expense' && c.active).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Dia do mês *</label>
                      <input type="number" min="1" max="28" value={recDay} onChange={e => setRecDay(e.target.value)} placeholder="5" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Valor (R$) *</label>
                    <input type="number" min="0" step="0.01" value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="0,00" />
                  </div>
                  {recError && <div className={styles.error}>{recError}</div>}
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setShowRecModal(false)}>Cancelar</button>
                    <button type="submit" className={styles.btnPrimary} disabled={recSaving}>
                      {recSaving ? 'Salvando…' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {recurringLoading ? (
            <div className={styles.skeleton}>
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skeletonRow} />)}
            </div>
          ) : recurring.length === 0 ? (
            <div className={styles.empty}><span>📅</span><p>Nenhuma despesa fixa cadastrada.</p></div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor</th>
                    <th>Dia do mês</th>
                    <th>Último lançamento</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map(r => (
                    <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{r.description}</td>
                      <td className={styles.tdMono}>{r.category}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: '#c0334d' }}>
                        − {(r.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className={styles.tdMuted}>Todo dia {r.day_of_month}</td>
                      <td className={styles.tdMuted}>
                        {r.last_generated ? r.last_generated.split('-').reverse().join('/') : 'Ainda não gerado'}
                      </td>
                      <td>
                        <span className={styles.badge} style={{
                          background: r.active ? '#dcfce7' : '#f3f4f6',
                          color: r.active ? '#15803d' : '#6b7280',
                        }}>
                          {r.active ? 'Ativa' : 'Pausada'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className={styles.iconBtn} title={r.active ? 'Pausar' : 'Reativar'} onClick={() => toggleRecurring(r)}>
                          {r.active ? '⏸️' : '▶️'}
                        </button>
                        <button className={styles.iconBtn} title="Remover" onClick={() => deleteRecurring(r)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <section className={cs.card}>
          <h2 className={cs.sectionTitle}>Configurações Operacionais</h2>
          <form onSubmit={saveSettings}>
            <div className={cs.grid3}>
              <div className={styles.field}>
                <label>SLA Manutenção (horas)</label>
                <input type="number" min="1" value={slaManut} onChange={e => setSlaManut(e.target.value)} placeholder="72" />
                <span className={cs.fieldHint}>Prazo para fechar chamados comuns</span>
              </div>
              <div className={styles.field}>
                <label>SLA Urgente (horas)</label>
                <input type="number" min="1" value={slaUrg} onChange={e => setSlaUrg(e.target.value)} placeholder="4" />
                <span className={cs.fieldHint}>Prazo para chamados urgentes</span>
              </div>
              <div className={styles.field}>
                <label>Taxa condominial (R$)</label>
                <input type="number" min="0" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="450.00" />
                <span className={cs.fieldHint}>Valor padrão por unidade</span>
              </div>
            </div>
            <div className={cs.formFooter}>
              {msg2 && <span className={msg2 === 'Salvo!' ? cs.msgOk : cs.msgErr}>{msg2}</span>}
              <button type="submit" className={styles.btnPrimary} disabled={saving2}>
                {saving2 ? 'Salvando…' : 'Salvar configurações'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
