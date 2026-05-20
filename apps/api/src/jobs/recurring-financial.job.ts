import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

interface RecurringRecord {
  id: string;
  condominium_id: string;
  description: string;
  category: string;
  amount: number;
  day_of_month: number;
  created_by: string | null;
  last_generated: string | null;
}

@Injectable()
export class RecurringFinancialJob {
  private readonly logger = new Logger(RecurringFinancialJob.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Roda todo dia às 06:00 UTC — gera lançamentos para o dia atual se houver recorrentes
  @Cron('0 6 * * *')
  async run(): Promise<void> {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

    const admin = this.supabaseService.getAdminClient();

    // Busca recorrentes ativos cujo dia_of_month é hoje e que ainda não foram gerados este mês
    const { data, error } = await admin
      .from('financial_recurring')
      .select('*')
      .eq('active', true)
      .eq('day_of_month', dayOfMonth)
      .or(`last_generated.is.null,last_generated.lt.${currentMonth}-01`);

    if (error) {
      this.logger.error('Erro ao buscar recorrentes', error.message);
      return;
    }

    const records = (data ?? []) as RecurringRecord[];
    if (records.length === 0) return;

    this.logger.log(`Gerando ${records.length} lançamento(s) recorrente(s) para ${today.toISOString().slice(0, 10)}`);

    const dueDate = today.toISOString().slice(0, 10);

    for (const rec of records) {
      const competencia = dueDate.slice(0, 8) + '01';
      const { error: insertError } = await admin
        .from('financial_records')
        .insert({
          condominium_id: rec.condominium_id,
          type: 'expense',
          category: rec.category,
          description: `${rec.description} (automático)`,
          amount: rec.amount,
          due_date: dueDate,
          competencia,
          created_by: rec.created_by,
        });

      if (insertError) {
        this.logger.error(`Falha ao gerar lançamento para recorrente ${rec.id}: ${insertError.message}`);
        continue;
      }

      await admin
        .from('financial_recurring')
        .update({ last_generated: dueDate })
        .eq('id', rec.id);
    }

    this.logger.log(`${records.length} lançamento(s) recorrente(s) gerado(s) com sucesso`);
  }
}
