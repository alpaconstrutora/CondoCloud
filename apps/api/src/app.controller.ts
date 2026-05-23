import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getPrivacy(): string {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Política de Privacidade — CondoCloud</title>
    <style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}h1{color:#1a1a1a}</style></head>
    <body><h1>Política de Privacidade — CondoCloud</h1>
    <p>Última atualização: maio de 2026</p>
    <p>O CondoCloud coleta e utiliza dados pessoais (nome, e-mail, telefone e WhatsApp) exclusivamente para prestação dos serviços de gestão condominial, envio de notificações e comunicação entre moradores e síndicos.</p>
    <p>Não compartilhamos dados com terceiros, exceto fornecedores de infraestrutura (Supabase, Meta WhatsApp Business API) necessários para o funcionamento do serviço.</p>
    <p>Os dados são armazenados com segurança e podem ser excluídos mediante solicitação pelo e-mail: <a href="mailto:alpaconstrutora@gmail.com">alpaconstrutora@gmail.com</a></p>
    </body></html>`;
  }
}
