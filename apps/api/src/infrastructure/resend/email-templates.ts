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
