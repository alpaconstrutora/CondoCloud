import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { PLAN_LIMITS } from '@condocloud/shared';
import type { PlanName, TicketCategory, TicketPriority } from '@condocloud/shared';

interface AiClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  private get client(): Anthropic {
    if (!this.anthropic) throw new BadRequestException('ANTHROPIC_API_KEY não configurada');
    return this.anthropic;
  }

  async classifyTicket(condoId: string, ticketId: string): Promise<AiClassificationResult> {
    await this.checkAiQuota(condoId);

    const { data: ticket } = await this.supabaseService
      .getAdminClient()
      .from('tickets')
      .select('title, description, category, priority')
      .eq('id', ticketId)
      .eq('condominium_id', condoId)
      .single();

    if (!ticket) throw new BadRequestException('Chamado não encontrado');
    const t = ticket as { title: string; description?: string; category: string; priority: string };

    const prompt = `Você é um assistente de gestão condominial. Classifique o seguinte chamado:

Título: ${t.title}
Descrição: ${t.description ?? 'Sem descrição'}

Categorias válidas: manutencao, seguranca, limpeza, barulho, area_comum, outro
Prioridades válidas: low, medium, high, urgent

Responda APENAS em JSON válido no formato:
{
  "category": "<categoria>",
  "priority": "<prioridade>",
  "confidence": <número de 0 a 1>,
  "reasoning": "<explicação em 1 frase>"
}`;

    const startMs = Date.now();
    let tokensUsed = 0;
    let success = true;
    let errorMessage: string | undefined;
    let result: AiClassificationResult;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      result = JSON.parse(text) as AiClassificationResult;

      // Persiste a classificação no ticket
      await this.supabaseService
        .getAdminClient()
        .from('tickets')
        .update({ ai_classification: result })
        .eq('id', ticketId);
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Falha na classificação IA: ${errorMessage}`);
    } finally {
      await this.logUsage(condoId, 'classifyTicket', tokensUsed, Date.now() - startMs, success, errorMessage);
    }

    return result;
  }

  async generateAssemblyMinutes(condoId: string, assemblyId: string): Promise<{ minutes_text: string }> {
    await this.checkAiQuota(condoId);

    const { data: assembly } = await this.supabaseService
      .getAdminClient()
      .from('assemblies')
      .select('*, assembly_items(*, votes(*))')
      .eq('id', assemblyId)
      .eq('condominium_id', condoId)
      .single();

    if (!assembly) throw new BadRequestException('Assembleia não encontrada');

    const a = assembly as {
      title: string;
      date: string;
      location?: string;
      assembly_items: Array<{
        title: string;
        description?: string;
        result?: string;
        votes: Array<{ vote: string }>;
      }>;
    };

    const itemsSummary = a.assembly_items
      .map((item, idx) => {
        const yes = item.votes.filter((v) => v.vote === 'yes').length;
        const no = item.votes.filter((v) => v.vote === 'no').length;
        const abstain = item.votes.filter((v) => v.vote === 'abstain').length;
        return `${idx + 1}. ${item.title}\n   ${item.description ?? ''}\n   Votos: ${yes} sim / ${no} não / ${abstain} abstencão\n   Resultado: ${item.result ?? 'Pendente'}`;
      })
      .join('\n\n');

    const prompt = `Redija a ata formal de uma assembleia condominial com as seguintes informações:

Título: ${a.title}
Data: ${new Date(a.date).toLocaleDateString('pt-BR')}
Local: ${a.location ?? 'Salão de festas'}

Pautas e resultados:
${itemsSummary}

Escreva uma ata formal em português, com linguagem jurídica adequada. Inclua abertura, registro de cada pauta com resultado, e encerramento. Use parágrafo para cada pauta.`;

    const startMs = Date.now();
    let tokensUsed = 0;
    let success = true;
    let errorMessage: string | undefined;
    let minutesText = '';

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      minutesText = response.content[0].type === 'text' ? response.content[0].text : '';

      // Salva URL da ata (o PDF seria gerado por um job separado)
      await this.supabaseService
        .getAdminClient()
        .from('assemblies')
        .update({ minutes_url: `data:text/plain;base64,${Buffer.from(minutesText).toString('base64')}` })
        .eq('id', assemblyId);
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Falha na geração da ata: ${errorMessage}`);
    } finally {
      await this.logUsage(condoId, 'generateAssemblyMinutes', tokensUsed, Date.now() - startMs, success, errorMessage);
    }

    return { minutes_text: minutesText };
  }

  private async checkAiQuota(condoId: string): Promise<void> {
    const { data: condo } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('plans(name)')
      .eq('id', condoId)
      .single();

    const planName = ((condo as { plans?: { name: string } } | null)?.plans?.name ?? 'starter') as PlanName;
    const maxCalls = PLAN_LIMITS[planName]?.max_ai_calls ?? 100;

    // Conta chamadas do mês atual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await this.supabaseService
      .getAdminClient()
      .from('ai_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condoId)
      .eq('success', true)
      .gte('created_at', startOfMonth.toISOString());

    if ((count ?? 0) >= maxCalls) {
      throw new BadRequestException(
        `Limite de ${maxCalls} chamadas de IA atingido para o plano ${planName}. Aguarde o próximo ciclo ou faça upgrade.`,
      );
    }
  }

  private async logUsage(
    condoId: string,
    functionName: 'classifyTicket' | 'generateAssemblyMinutes',
    tokensUsed: number,
    durationMs: number,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.supabaseService.getAdminClient().from('ai_usage_log').insert({
        condominium_id: condoId,
        function_name: functionName,
        tokens_used: tokensUsed,
        duration_ms: durationMs,
        success,
        error_message: errorMessage,
      });
    } catch (err) {
      this.logger.error('Falha ao registrar uso de IA', err);
    }
  }
}
