import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateFinancialRecordDto, GenerateChargesFromRateioDto } from './dto/financial.dto';

interface FinancialCategory {
  id: string;
  condominium_id: string;
  name: string;
  type: 'income' | 'expense';
  active: boolean;
  is_default: boolean;
  vendor_id: string | null;
  created_at: string;
}

interface FinancialRecord {
  id: string;
  type: string;
  amount: number;
  description?: string;
  category?: string;
  unit_id?: string;
  due_date?: string;
  competencia?: string;
  paid_at?: string;
  payment_method?: string;
  receipt_url?: string;
  condominium_id: string;
  created_by?: string;
  created_at: string;
}

interface FinancialSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  saldo_anterior: number;
  pending_count: number;
}

interface FinancialClosing {
  id: string;
  condominium_id: string;
  competencia: string;
  closed_at: string;
  closed_by: string | null;
  saldo_inicial: number;
  total_income: number;
  total_expense: number;
  saldo_final: number;
  notes: string | null;
}

@Injectable()
export class FinancialService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private monthRange(competencia: string): { start: string; end: string } {
    const [year, month] = competencia.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    return { start, end };
  }

  async create(condoId: string, createdBy: string, dto: CreateFinancialRecordDto): Promise<FinancialRecord> {
    // Derive competencia from due_date if not provided
    const competencia = dto.competencia
      ?? (dto.due_date ? dto.due_date.slice(0, 8) + '01' : new Date().toISOString().slice(0, 8) + '01');

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('financial_records')
      .insert({ ...dto, competencia, condominium_id: condoId, created_by: createdBy })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as FinancialRecord;
  }

  async findAll(condoId: string, type?: string, competencia?: string): Promise<FinancialRecord[]> {
    let query = this.supabaseService
      .getAdminClient()
      .from('financial_records')
      .select('*')
      .eq('condominium_id', condoId)
      .order('competencia', { ascending: false })
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);

    if (competencia) {
      const { start, end } = this.monthRange(competencia);
      query = query.gte('competencia', start).lt('competencia', end);
    }

    const { data } = await query;
    return (data ?? []) as FinancialRecord[];
  }

  async update(condoId: string, id: string, dto: Partial<CreateFinancialRecordDto>): Promise<FinancialRecord> {
    // Recompute competencia when due_date changes and competencia not explicitly set
    if (dto.due_date && !dto.competencia) {
      dto.competencia = dto.due_date.slice(0, 8) + '01';
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('financial_records')
      .update(dto)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as FinancialRecord;
  }

  async remove(condoId: string, id: string): Promise<void> {
    // Check if the record's month is closed
    const { data: rec } = await this.supabaseService.getAdminClient()
      .from('financial_records')
      .select('competencia')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (rec?.competencia) {
      const { data: closing } = await this.supabaseService.getAdminClient()
        .from('financial_closings')
        .select('id')
        .eq('condominium_id', condoId)
        .eq('competencia', rec.competencia)
        .maybeSingle();
      if (closing) throw new BadRequestException('Período fechado. Reabra o mês antes de excluir.');
    }

    const { error } = await this.supabaseService
      .getAdminClient()
      .from('financial_records')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
  }

  async getSummary(condoId: string, competencia?: string): Promise<FinancialSummary> {
    const admin = this.supabaseService.getAdminClient();

    if (competencia) {
      const { start, end } = this.monthRange(competencia);

      const [prevRes, currRes] = await Promise.all([
        admin.from('financial_records').select('type, amount').eq('condominium_id', condoId).lt('competencia', start),
        admin.from('financial_records').select('type, amount, paid_at').eq('condominium_id', condoId).gte('competencia', start).lt('competencia', end),
      ]);

      const prev = (prevRes.data ?? []) as FinancialRecord[];
      const curr = (currRes.data ?? []) as FinancialRecord[];

      const prevIncome = prev.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
      const prevExpense = prev.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      const saldoAnterior = prevIncome - prevExpense;

      const totalIncome = curr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
      const totalExpense = curr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      const pendingCount = curr.filter(r => r.type === 'expense' && !r.paid_at).length;

      return {
        total_income: totalIncome,
        total_expense: totalExpense,
        balance: saldoAnterior + totalIncome - totalExpense,
        saldo_anterior: saldoAnterior,
        pending_count: pendingCount,
      };
    }

    // All-time fallback
    const { data } = await admin.from('financial_records').select('type, amount, paid_at').eq('condominium_id', condoId);
    const records = (data ?? []) as FinancialRecord[];
    const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
      saldo_anterior: 0,
      pending_count: records.filter(r => r.type === 'expense' && !r.paid_at).length,
    };
  }

  // ── Geração manual de recorrentes ────────────────────────────

  async generateRecurringForMonth(condoId: string, competencia: string): Promise<{ generated: number; skipped: number }> {
    const admin = this.supabaseService.getAdminClient();
    const [year, month] = competencia.split('-').map(Number);

    // Build month boundaries directly from the competencia string — no timezone risk
    const monthStart = `${competencia}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // Last day of target month (UTC-safe)
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // Fetch all active recurring for this condo
    const { data: recData } = await admin
      .from('financial_recurring')
      .select('*')
      .eq('condominium_id', condoId)
      .eq('active', true);

    const recurrings = (recData ?? []) as Array<{
      id: string; description: string; category: string; amount: number;
      day_of_month: number; created_by: string | null; last_generated: string | null;
    }>;

    let generated = 0;
    let skipped = 0;

    for (const rec of recurrings) {
      // Skip if already generated this month
      if (rec.last_generated && rec.last_generated >= monthStart && rec.last_generated < monthEnd) {
        skipped++;
        continue;
      }

      const day = Math.min(rec.day_of_month, lastDayOfMonth);
      // Build due_date directly from competencia — e.g. "2026-04" + "-10" = "2026-04-10"
      const dueDate = `${competencia}-${String(day).padStart(2, '0')}`;

      const { error } = await admin.from('financial_records').insert({
        condominium_id: condoId,
        type: 'expense',
        category: rec.category,
        description: `${rec.description} (automático)`,
        amount: rec.amount,
        due_date: dueDate,
        competencia: monthStart,
        created_by: rec.created_by,
      });

      if (error) continue;

      await admin.from('financial_recurring').update({ last_generated: dueDate }).eq('id', rec.id);
      generated++;
    }

    return { generated, skipped };
  }

  // ── Fechamentos ───────────────────────────────────────────────

  async listClosings(condoId: string): Promise<FinancialClosing[]> {
    const { data } = await this.supabaseService.getAdminClient()
      .from('financial_closings')
      .select('*')
      .eq('condominium_id', condoId)
      .order('competencia', { ascending: false });
    return (data ?? []) as FinancialClosing[];
  }

  async closeMonth(condoId: string, closedBy: string, competencia: string, notes?: string): Promise<FinancialClosing> {
    const admin = this.supabaseService.getAdminClient();
    const { start } = this.monthRange(competencia);

    const { data: existing } = await admin
      .from('financial_closings')
      .select('id')
      .eq('condominium_id', condoId)
      .eq('competencia', start)
      .maybeSingle();

    if (existing) throw new BadRequestException('Este mês já foi fechado.');

    const summary = await this.getSummary(condoId, competencia);

    const { data, error } = await admin
      .from('financial_closings')
      .insert({
        condominium_id: condoId,
        competencia: start,
        closed_by: closedBy,
        saldo_inicial: summary.saldo_anterior,
        total_income: summary.total_income,
        total_expense: summary.total_expense,
        saldo_final: summary.balance,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Auto-generate recurring expenses for the next month
    const [year, month] = competencia.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextCompetencia = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    this.generateRecurringForMonth(condoId, nextCompetencia).catch(() => { /* non-fatal */ });

    return data as FinancialClosing;
  }

  async reopenMonth(condoId: string, competencia: string): Promise<void> {
    const { start } = this.monthRange(competencia);
    const { error } = await this.supabaseService.getAdminClient()
      .from('financial_closings')
      .delete()
      .eq('condominium_id', condoId)
      .eq('competencia', start);
    if (error) throw new Error(error.message);
  }

  // ── Recorrentes ───────────────────────────────────────────────

  async listRecurring(condoId: string): Promise<unknown[]> {
    const { data } = await this.supabaseService.getAdminClient()
      .from('financial_recurring')
      .select('*')
      .eq('condominium_id', condoId)
      .order('description');
    return data ?? [];
  }

  async createRecurring(
    condoId: string,
    createdBy: string,
    dto: { description: string; category: string; amount: number; day_of_month: number },
  ): Promise<unknown> {
    const { data, error } = await this.supabaseService.getAdminClient()
      .from('financial_recurring')
      .insert({
        condominium_id: condoId,
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        day_of_month: dto.day_of_month,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateRecurring(
    condoId: string,
    id: string,
    dto: { description?: string; category?: string; amount?: number; day_of_month?: number; active?: boolean },
  ): Promise<unknown> {
    const patch: Record<string, unknown> = {};
    if (dto.description !== undefined) patch['description'] = dto.description;
    if (dto.category !== undefined) patch['category'] = dto.category;
    if (dto.amount !== undefined) patch['amount'] = dto.amount;
    if (dto.day_of_month !== undefined) patch['day_of_month'] = dto.day_of_month;
    if (dto.active !== undefined) patch['active'] = dto.active;

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('financial_recurring')
      .update(patch)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Recorrente não encontrado');
    return data;
  }

  async deleteRecurring(condoId: string, id: string): Promise<void> {
    const { error } = await this.supabaseService.getAdminClient()
      .from('financial_recurring')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
  }

  // ── Categorias ────────────────────────────────────────────────

  async listCategories(condoId: string, type?: string): Promise<FinancialCategory[]> {
    let query = this.supabaseService.getAdminClient()
      .from('financial_categories')
      .select('*, vendors(id, company_name, specialty)')
      .eq('condominium_id', condoId)
      .eq('active', true)
      .order('type')
      .order('name');
    if (type) query = query.eq('type', type);
    const { data } = await query;
    return (data ?? []) as FinancialCategory[];
  }

  async createCategory(condoId: string, dto: { name: string; type: 'income' | 'expense'; vendor_id?: string }): Promise<FinancialCategory> {
    const { data, error } = await this.supabaseService.getAdminClient()
      .from('financial_categories')
      .insert({ name: dto.name.trim(), type: dto.type, vendor_id: dto.vendor_id ?? null, condominium_id: condoId })
      .select('*, vendors(id, company_name, specialty)')
      .single();
    if (error) throw new Error(error.message);
    return data as FinancialCategory;
  }

  async updateCategory(condoId: string, id: string, dto: { name?: string; active?: boolean; vendor_id?: string | null }): Promise<FinancialCategory> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch['name'] = dto.name.trim();
    if (dto.active !== undefined) patch['active'] = dto.active;
    if ('vendor_id' in dto) patch['vendor_id'] = dto.vendor_id ?? null;

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('financial_categories')
      .update(patch)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select('*, vendors(id, company_name, specialty)')
      .single();
    if (error || !data) throw new NotFoundException('Categoria não encontrada');
    return data as FinancialCategory;
  }

  async deleteCategory(condoId: string, id: string): Promise<void> {
    const { error } = await this.supabaseService.getAdminClient()
      .from('financial_categories')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId)
      .eq('is_default', false);
    if (error) throw new Error(error.message);
  }

  // ── Gerar cobranças a partir do rateio ────────────────────────

  async generateChargesFromRateio(
    condoId: string,
    dto: GenerateChargesFromRateioDto,
  ): Promise<{ created: number; errors: string[] }> {
    const admin = this.supabaseService.getAdminClient();
    const { start, end } = this.monthRange(dto.competencia);

    // 1. Validar mês fechado
    const { data: closing } = await admin
      .from('financial_closings')
      .select('id')
      .eq('condominium_id', condoId)
      .eq('competencia', start)
      .maybeSingle();

    if (!closing) {
      throw new BadRequestException('Feche o mês antes de gerar cobranças.');
    }

    // 2. Verificar duplicidade pela competencia (ignorar canceladas)
    const { data: existing } = await admin
      .from('charges')
      .select('id')
      .eq('condominium_id', condoId)
      .eq('competencia', start)
      .neq('status', 'cancelled')
      .limit(1);

    if (existing && existing.length > 0) {
      if (!dto.force_cancel) {
        throw new ConflictException(
          'Já existem cobranças geradas para esta competência. Cancele-as antes de regerar.',
        );
      }
      // Cancelar automaticamente as cobranças não pagas
      await admin
        .from('charges')
        .update({ status: 'cancelled' })
        .eq('condominium_id', condoId)
        .eq('competencia', start)
        .neq('status', 'paid');
    }

    // 3. Buscar unidades com moradores
    const { data: unitsData, error: unitsError } = await admin
      .from('units')
      .select('id, number, size_sqm, unit_profiles(profile_id, is_responsible, profiles(id, name))')
      .eq('condominium_id', condoId)
      .order('number');

    if (unitsError) throw new Error(unitsError.message);

    const units = (unitsData ?? []) as unknown as Array<{
      id: string;
      number: string;
      size_sqm: number | null;
      unit_profiles: Array<{
        profile_id: string;
        is_responsible: boolean;
        profiles: { id: string; name: string } | null;
      }>;
    }>;

    // 4. Calcular rateio server-side
    const summary = await this.getSummary(condoId, dto.competencia);
    const totalExpense = summary.total_expense;
    const totalSize = units.reduce((s, u) => s + (u.size_sqm ?? 0), 0);

    type RateioLine = { unit: typeof units[number]; amount: number };
    let rateioLines: RateioLine[] = [];

    if (dto.method === 'igualitario') {
      const perUnit = units.length > 0 ? totalExpense / units.length : 0;
      rateioLines = units.map(u => ({ unit: u, amount: perUnit }));
    } else if (dto.method === 'fracaoIdeal') {
      rateioLines = units.map(u => {
        const frac = totalSize > 0 ? (u.size_sqm ?? 0) / totalSize : 1 / units.length;
        return { unit: u, amount: frac * totalExpense };
      });
    } else if (dto.method === 'consumoIndividual') {
      const consumo = dto.consumoIndividual ?? {};
      const totalConsumo = Object.values(consumo).reduce((s, v) => s + (Number(v) || 0), 0);
      const base = units.length > 0 ? Math.max(0, totalExpense - totalConsumo) / units.length : 0;
      rateioLines = units.map(u => ({
        unit: u,
        amount: base + (Number(consumo[u.id] ?? 0) || 0),
      }));
    } else if (dto.method === 'misto') {
      // Fetch expenses by category for this competencia
      const { data: expRecords } = await admin
        .from('financial_records')
        .select('category, amount')
        .eq('condominium_id', condoId)
        .eq('type', 'expense')
        .gte('competencia', start)
        .lt('competencia', end);

      const byCategory: Record<string, number> = {};
      for (const r of (expRecords ?? []) as { category: string | null; amount: number }[]) {
        const cat = r.category ?? 'Outros';
        byCategory[cat] = (byCategory[cat] ?? 0) + r.amount;
      }

      const mistoMethods = dto.mistoMethods ?? {};
      rateioLines = units.map(u => {
        const frac = totalSize > 0 ? (u.size_sqm ?? 0) / totalSize : 1 / units.length;
        let total = 0;
        for (const [cat, amount] of Object.entries(byCategory)) {
          const m = mistoMethods[cat] ?? 'igualitario';
          total += m === 'fracaoIdeal' ? frac * amount : amount / units.length;
        }
        return { unit: u, amount: total };
      });
    }

    // 5. Montar inserts
    const description = dto.description?.trim() ||
      `Rateio condominial — ${dto.competencia.slice(5, 7)}/${dto.competencia.slice(0, 4)}`;

    const errors: string[] = [];
    const inserts: Array<{
      unit_id: string;
      profile_id: string | null;
      description: string;
      amount: number;
      due_date: string;
      status: string;
      condominium_id: string;
      competencia: string;
    }> = [];

    if (dto.billing_target === 'unit') {
      // Uma cobrança por unidade
      for (const { unit, amount } of rateioLines) {
        if (amount <= 0) continue;
        inserts.push({
          unit_id: unit.id,
          profile_id: null,
          description,
          amount: Math.round(amount * 100) / 100,
          due_date: dto.due_date,
          status: 'pending',
          condominium_id: condoId,
          competencia: start,
        });
      }
    } else {
      // Cobrar por morador: agrupar por profile_id somando valores de todas as unidades
      // Map: profile_id → { unit_id (primeira unidade), total }
      const profileMap = new Map<string, { unit_id: string; amount: number }>();
      // Fallbacks para unidades sem moradores (geram cobrança por unidade mesmo no modo morador)
      const unitFallbacks: Array<{ unit_id: string; amount: number }> = [];

      for (const { unit, amount } of rateioLines) {
        if (amount <= 0) continue;
        const profiles = unit.unit_profiles ?? [];

        if (dto.split_mode === 'responsible') {
          const resp = profiles.find(p => p.is_responsible);
          if (!resp) {
            errors.push(`Unidade ${unit.number}: sem morador responsável definido.`);
            continue;
          }
          const entry = profileMap.get(resp.profile_id);
          if (entry) {
            entry.amount += amount;
          } else {
            profileMap.set(resp.profile_id, { unit_id: unit.id, amount });
          }
        } else {
          // Dividir igualmente entre os moradores da unidade, depois agrupar por morador
          if (profiles.length === 0) {
            unitFallbacks.push({ unit_id: unit.id, amount });
          } else {
            const perResident = amount / profiles.length;
            for (const p of profiles) {
              const entry = profileMap.get(p.profile_id);
              if (entry) {
                entry.amount += perResident;
              } else {
                profileMap.set(p.profile_id, { unit_id: unit.id, amount: perResident });
              }
            }
          }
        }
      }

      // Uma cobrança por morador (soma de todas as unidades dele)
      for (const [profileId, { unit_id, amount }] of profileMap) {
        inserts.push({
          unit_id,
          profile_id: profileId,
          description,
          amount: Math.round(amount * 100) / 100,
          due_date: dto.due_date,
          status: 'pending',
          condominium_id: condoId,
          competencia: start,
        });
      }

      // Unidades sem morador: gerar cobrança por unidade como fallback
      for (const { unit_id, amount } of unitFallbacks) {
        inserts.push({
          unit_id,
          profile_id: null,
          description,
          amount: Math.round(amount * 100) / 100,
          due_date: dto.due_date,
          status: 'pending',
          condominium_id: condoId,
          competencia: start,
        });
      }
    }

    // 6. Batch insert
    if (inserts.length > 0) {
      const { error: insertError } = await admin.from('charges').insert(inserts);
      if (insertError) throw new Error(insertError.message);
    }

    return { created: inserts.length, errors };
  }
}
