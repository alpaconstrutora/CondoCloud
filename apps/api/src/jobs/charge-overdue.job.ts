import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { ChargeService } from '../modules/charge/charge.service';

@Injectable()
export class ChargeOverdueJob {
  private readonly logger = new Logger(ChargeOverdueJob.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly chargeService: ChargeService,
  ) {}

  // Roda todo dia às 07:00 UTC — marca cobranças vencidas como 'overdue'
  @Cron('0 7 * * *')
  async run(): Promise<void> {
    const admin = this.supabaseService.getAdminClient();

    // Busca todos os condomínios ativos
    const { data, error } = await admin
      .from('condominiums')
      .select('id')
      .in('subscription_status', ['active', 'trialing', 'past_due'])
      .eq('activated', true);

    if (error) {
      this.logger.error('Erro ao buscar condomínios para marcar overdue', error.message);
      return;
    }

    const condos = (data ?? []) as { id: string }[];
    if (condos.length === 0) return;

    let totalMarked = 0;

    for (const condo of condos) {
      try {
        const count = await this.chargeService.markOverdue(condo.id);
        if (count > 0) {
          this.logger.log(`[${condo.id}] ${count} cobrança(s) marcada(s) como overdue`);
          totalMarked += count;
        }
      } catch (err) {
        this.logger.error(`Erro ao marcar overdue para condomínio ${condo.id}`, err);
      }
    }

    if (totalMarked > 0) {
      this.logger.log(`Total: ${totalMarked} cobrança(s) marcada(s) como overdue em ${condos.length} condomínio(s)`);
    }
  }
}
