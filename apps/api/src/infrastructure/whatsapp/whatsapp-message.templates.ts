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
};
