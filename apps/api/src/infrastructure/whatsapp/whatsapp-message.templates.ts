export const whatsappTemplates = {
  ticketResolved: (condoName: string, title: string) =>
    `✅ *CondoCloud — ${condoName}*\n\nSeu chamado _"${title}"_ foi resolvido. Acesse o app para ver os detalhes.`,

  newResident: (condoName: string) =>
    `👋 *CondoCloud — ${condoName}*\n\nUm novo morador aceitou o convite e entrou no condomínio. Acesse o painel para ver a lista atualizada.`,

  proposalInteraction: (condoName: string) =>
    `👍 *CondoCloud — ${condoName}*\n\nAlguém aprovou sua proposta comercial. Acesse o app para ver os detalhes.`,

  proposalApproved: (condoName: string) =>
    `🎉 *CondoCloud — ${condoName}*\n\nSua proposta comercial foi _convertida_ (contrato fechado). Acesse o app para ver os detalhes.`,

  roiUpdated: (condoName: string, messagesAvoided: number, ticketsResolved: number) =>
    `📊 *CondoCloud — ${condoName}*\n\nResumo do dia:\n• *${messagesAvoided}* mensagens digitais enviadas\n• *${ticketsResolved}* chamados resolvidos no total\n\nAcesse o painel para ver o relatório completo.`,

  chargeCreated: (condoName: string, description: string, amount: number, dueDate: string) => {
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    const due = new Date(dueDate + 'T00:00:00').toLocaleDateString('pt-BR');
    return `💰 *CondoCloud — ${condoName}*\n\nNova cobrança emitida:\n_${description}_\n\nValor: *${formatted}*\nVencimento: *${due}*\n\nAcesse o app para ver os detalhes.`;
  },

  messagePublished: (condoName: string, title: string) =>
    `📢 *CondoCloud — ${condoName}*\n\nNovo comunicado:\n_"${title}"_\n\nAcesse o app para ler o comunicado completo.`,

  ticketCreated: (condoName: string, title: string, category: string) =>
    `🎫 *CondoCloud — ${condoName}*\n\nNovo chamado aberto:\n_"${title}"_\nCategoria: *${category}*\n\nAcesse o painel para gerenciar o chamado.`,
};
