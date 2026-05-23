function layout(condoName: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 0}
  .wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .top{background:#1a472a;padding:24px 32px}
  .top h1{color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:.02em}
  .top p{color:#a7f3d0;margin:4px 0 0;font-size:13px}
  .body{padding:32px}
  .body p{color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px}
  .cta{display:inline-block;background:#1a472a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:8px}
  .footer{padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="top">
    <h1>CondoCloud</h1>
    <p>${condoName}</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Você recebeu este e-mail porque está cadastrado no CondoCloud. Não responda a este e-mail.</div>
</div></body></html>`;
}

export function ticketResolvedEmail(condoName: string, ticketTitle: string): string {
  return layout(condoName, `
    <p>✅ <strong>Seu chamado foi resolvido!</strong></p>
    <p>O chamado <em>"${ticketTitle}"</em> foi marcado como resolvido pelo síndico ou responsável.</p>
    <p>Acesse o aplicativo para ver os detalhes da resolução.</p>
  `);
}

export function newResidentEmail(condoName: string): string {
  return layout(condoName, `
    <p>👋 <strong>Novo morador entrou!</strong></p>
    <p>Um morador aceitou o convite e agora faz parte do <strong>${condoName}</strong> no CondoCloud.</p>
    <p>Acesse o painel para ver a lista de moradores atualizada.</p>
  `);
}

export function proposalApprovedEmail(condoName: string): string {
  return layout(condoName, `
    <p>👍 <strong>Sua proposta foi aprovada!</strong></p>
    <p>Alguém aprovou sua proposta comercial no <strong>${condoName}</strong>.</p>
    <p>Acesse o aplicativo para ver mais detalhes.</p>
  `);
}

export function proposalConvertedEmail(condoName: string): string {
  return layout(condoName, `
    <p>🎉 <strong>Proposta convertida!</strong></p>
    <p>Sua proposta comercial no <strong>${condoName}</strong> foi marcada como convertida — contrato fechado.</p>
    <p>Acesse o aplicativo para ver os detalhes.</p>
  `);
}

export function chargeCreatedEmail(condoName: string, description: string, amount: number, dueDate: string): string {
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const due = new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR');
  return layout(condoName, `
    <p>💰 <strong>Nova cobrança emitida</strong></p>
    <p><em>${description}</em></p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Valor</td><td style="font-weight:700;text-align:right">${formatted}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Vencimento</td><td style="font-weight:700;text-align:right">${due}</td></tr>
    </table>
    <p>Acesse o aplicativo para ver os detalhes e formas de pagamento.</p>
  `);
}

export function messagePublishedEmail(condoName: string, title: string, content: string): string {
  return layout(condoName, `
    <p>📢 <strong>Novo comunicado</strong></p>
    <p style="font-size:17px;font-weight:700">${title}</p>
    <p>${content}</p>
    <p style="color:#6b7280;font-size:13px">Acesse o aplicativo para ler o comunicado completo.</p>
  `);
}

export function ticketCreatedEmail(condoName: string, title: string, category: string): string {
  return layout(condoName, `
    <p>🎫 <strong>Novo chamado aberto</strong></p>
    <p><em>"${title}"</em></p>
    <p>Categoria: <strong>${category}</strong></p>
    <p>Acesse o painel para gerenciar e responder ao chamado.</p>
  `);
}

export function roiUpdatedEmail(condoName: string, messagesAvoided: number, ticketsResolved: number): string {
  return layout(condoName, `
    <p>📊 <strong>Resumo do dia — ${condoName}</strong></p>
    <p>Veja como o CondoCloud está gerando valor hoje:</p>
    <ul style="color:#374151;font-size:15px;line-height:1.8">
      <li><strong>${messagesAvoided}</strong> mensagens digitais enviadas</li>
      <li><strong>${ticketsResolved}</strong> chamados resolvidos no total</li>
    </ul>
    <p>Acesse o painel para o relatório completo.</p>
  `);
}
